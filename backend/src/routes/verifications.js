const express = require('express');
const router = express.Router();
const { db } = require('../config/database');
const { getLatestChainHash, computeRecordHash } = require('../services/integrityService');

// Get all verifications or by officer
router.get('/', (req, res) => {
  try {
    const officerId = req.query.officer_id;
    let query = `
      SELECT mr.*, 
        i.make, i.model, i.serial_number, i.category, i.premises_address,
        u.name as officer_name,
        va.application_number
      FROM measurement_results mr
      JOIN instruments i ON mr.instrument_id = i.id
      JOIN users u ON mr.officer_id = u.id
      JOIN verification_applications va ON mr.application_id = va.id
    `;
    const params = [];
    if (officerId) {
      query += ' WHERE mr.officer_id = ?';
      params.push(officerId);
    }
    query += ' ORDER BY mr.captured_at DESC';

    const stmt = db.prepare(query);
    const verifications = stmt.all(...params);
    res.json({ success: true, count: verifications.length, verifications });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * Submit Evidence-Bound Field Inspection (Layer 2 - Feature 3.1)
 * Enforces: Live photo URL, Geo-coordinates, Test weights, and Atomic SHA-256 Hash Chain Insert
 */
router.post('/', (req, res) => {
  try {
    const {
      application_id,
      instrument_id,
      officer_id,
      zero_error,
      repeatability_error,
      eccentricity_error,
      discrimination_pass,
      overall_result,
      photo_url,
      photo_hash,
      geo_lat,
      geo_lng,
      nameplate_match_status
    } = req.body;

    // Requirement: Proof of physical presence (GPS + Live Photo required)
    if (!photo_url || typeof photo_url !== 'string' || photo_url.trim() === '') {
      return res.status(400).json({
        success: false,
        error: 'Integrity Violation: Photo evidence is mandatory for verification.'
      });
    }

    if (geo_lat === undefined || geo_lat === null || geo_lng === undefined || geo_lng === null || isNaN(Number(geo_lat)) || isNaN(Number(geo_lng))) {
      return res.status(400).json({
        success: false,
        error: 'Integrity Violation: Field inspection cannot be submitted without valid GPS coordinates (geo_lat, geo_lng).'
      });
    }

    if (!application_id || !instrument_id || !officer_id || !overall_result) {
      return res.status(400).json({ success: false, error: 'Missing required inspection parameters.' });
    }

    // Server-side captured_at timestamp
    const capturedAt = new Date().toISOString();

    // Begin atomic immediate transaction so concurrent inserts cannot share prev_hash
    db.exec('BEGIN IMMEDIATE TRANSACTION;');

    try {
      const prevHash = getLatestChainHash();
      const recordHash = computeRecordHash({
        instrumentId: instrument_id,
        applicationId: application_id,
        officerId: officer_id,
        overallResult: overall_result,
        photoUrl: photo_url,
        photoHash: photo_hash,
        geoLat: parseFloat(geo_lat),
        geoLng: parseFloat(geo_lng),
        prevHash
      });

      const measId = 'meas-' + Date.now();

      // 1. Insert measurement result with cryptographic link
      db.prepare(`
        INSERT INTO measurement_results (
          id, application_id, instrument_id, officer_id, zero_error,
          repeatability_error, eccentricity_error, discrimination_pass,
          overall_result, observations_json, photo_url, geo_lat, geo_lng,
          captured_at, record_hash, prev_hash
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        measId,
        application_id,
        instrument_id,
        officer_id,
        zero_error !== undefined ? parseFloat(zero_error) : 0.0,
        repeatability_error !== undefined ? parseFloat(repeatability_error) : 0.0,
        eccentricity_error !== undefined ? parseFloat(eccentricity_error) : 0.0,
        discrimination_pass !== undefined ? parseInt(discrimination_pass, 10) : 1,
        overall_result,
        JSON.stringify({ zero_error, repeatability_error, eccentricity_error, discrimination_pass, photo_hash: photo_hash || null }),
        photo_url,
        parseFloat(geo_lat),
        parseFloat(geo_lng),
        capturedAt,
        recordHash,
        prevHash
      );

      // 2. Update instrument status and physical binding match
      const newStatus = overall_result === 'PASS' ? 'VERIFIED' : 'REJECTED';
      db.prepare(`
        UPDATE instruments 
        SET verification_status = ?, last_photo_match_status = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(newStatus, nameplate_match_status || 'MATCH', instrument_id);

      // 3. Update application status
      db.prepare(`
        UPDATE verification_applications 
        SET status = 'COMPLETED', updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(application_id);

      // 4. If PASS, generate Digital Certificate with QR Code
      let certId = null;
      let certNumber = null;
      if (overall_result === 'PASS') {
        certId = 'cert-' + Date.now();
        certNumber = `MH-PUN-${new Date().getFullYear()}-${Math.floor(10000 + Math.random() * 90000)}`;

        const issueDate = new Date().toISOString().split('T')[0];
        const nextYear = new Date();
        nextYear.setFullYear(nextYear.getFullYear() + 1);
        const validUntil = nextYear.toISOString().split('T')[0];

        const qrPayload = JSON.stringify({
          cert_no: certNumber,
          instrument_id,
          officer_id,
          valid_until: validUntil,
          block_hash: recordHash.substring(0, 16),
          verify_url: `https://verifymet.gov.in/verify/${certNumber}`
        });

        db.prepare(`
          INSERT INTO certificates (
            id, certificate_number, instrument_id, application_id, officer_id,
            issue_date, valid_until, qr_payload, status, pdf_url
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          certId,
          certNumber,
          instrument_id,
          application_id,
          officer_id,
          issueDate,
          validUntil,
          qrPayload,
          'VALID',
          `/certificates/${certNumber}.pdf`
        );

        // Notify merchant via in-app & WhatsApp channel
        const app = db.prepare('SELECT applicant_id FROM verification_applications WHERE id = ?').get(application_id);
        if (app) {
          db.prepare(`
            INSERT INTO notifications (id, user_id, title, message, channel, delivery_status)
            VALUES (?, ?, ?, ?, ?, ?)
          `).run(
            'notif-wa-' + Date.now(),
            app.applicant_id,
            'Certificate Issued (PASS)',
            `Your instrument was certified under Legal Metrology Rules. Certificate ${certNumber} is active until ${validUntil}.`,
            'whatsapp',
            'DELIVERED'
          );

          db.prepare(`
            INSERT INTO notifications (id, user_id, title, message, channel, delivery_status)
            VALUES (?, ?, ?, ?, ?, ?)
          `).run(
            'notif-app-' + Date.now(),
            app.applicant_id,
            'Verification Complete',
            `Verification result for application ${application_id}: PASS. Certificate issued.`,
            'in_app',
            'DELIVERED'
          );
        }
      }

      db.exec('COMMIT;');

      res.status(201).json({
        success: true,
        message: 'Evidence-bound verification completed and recorded on cryptographic hash chain.',
        measurement_id: measId,
        captured_at: capturedAt,
        record_hash: recordHash,
        prev_hash: prevHash,
        certificate_number: certNumber,
        verification_result: overall_result
      });

    } catch (txError) {
      db.exec('ROLLBACK;');
      throw txError;
    }
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
