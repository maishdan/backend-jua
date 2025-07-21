// reCAPTCHA verification endpoint - supports both v2 and v3
const axios = require('axios');

function setupRecaptchaEndpoint(app) {
  app.post('/api/verify-recaptcha', async (req, res) => {
    try {
      // Accept both v2 and v3 field names
      const token = req.body['g-recaptcha-response'] || req.body.token;
      const secretKey = '6Lf2HYgrAAAAAHvpe272LhCc6SfwXK_ak39tLBZl';

      console.log('reCAPTCHA verification request from IP:', req.ip);
      console.log('Token received:', token ? 'Yes' : 'No');

      if (!token) {
        return res.status(400).json({ 
          success: false, 
          message: 'reCAPTCHA token is missing' 
        });
      }

      // Verify with Google reCAPTCHA API
      const googleResponse = await axios.post(
        `https://www.google.com/recaptcha/api/siteverify`,
        null,
        {
          params: {
            secret: secretKey,
            response: token,
            remoteip: req.ip
          }
        }
      );

      const data = googleResponse.data;
      console.log('Google reCAPTCHA response:', data);

      if (data.success) {
        // v3: has score, v2: no score
        if (typeof data.score !== 'undefined') {
          // reCAPTCHA v3
          const score = data.score || 0.0;
          const action = data.action || 'submit';
          const threshold = 0.3; // Set your threshold (0.5 is typical, 0.1 is very permissive)

          if (score >= threshold) {
            console.log('reCAPTCHA v3 verification successful for IP:', req.ip, 'Score:', score, 'Action:', action);
            return res.status(200).json({ 
              success: true, 
              message: 'reCAPTCHA v3 verification passed',
              score,
              action,
              version: 'v3'
            });
          } else {
            console.log('reCAPTCHA v3 verification failed - low score for IP:', req.ip, 'Score:', score, 'Action:', action);
            return res.status(400).json({ 
              success: false, 
              message: 'reCAPTCHA v3 verification failed - suspicious activity detected',
              score,
              action,
              errors: ['low-score']
            });
          }
        } else {
          // reCAPTCHA v2
          console.log('reCAPTCHA v2 verification successful for IP:', req.ip);
          return res.status(200).json({ 
            success: true, 
            message: 'reCAPTCHA v2 verification passed',
            version: 'v2'
          });
        }
      } else {
        // Log failed verification with more details
        console.log('reCAPTCHA verification failed for IP:', req.ip, 'Errors:', data['error-codes']);
        return res.status(400).json({ 
          success: false, 
          message: 'reCAPTCHA verification failed',
          errors: data['error-codes'] || [],
          details: data
        });
      }
    } catch (err) {
      console.error('reCAPTCHA verification error:', err.message);
      return res.status(500).json({ 
        success: false, 
        message: 'Server error during reCAPTCHA verification',
        error: err.message
      });
    }
  });
}

module.exports = { setupRecaptchaEndpoint }; 