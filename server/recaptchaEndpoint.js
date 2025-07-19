// reCAPTCHA verification endpoint - supports both v2 and v3
const axios = require('axios');

function setupRecaptchaEndpoint(app) {
  app.post('/api/verify-recaptcha', async (req, res) => {
    try {
      const token = req.body['g-recaptcha-response'];
      const secretKey = '6Lf2HYgrAAAAAHvpe272LhCc6SfwXK_ak39tLBZl';

      if (!token) {
        return res.status(400).json({ 
          success: false, 
          message: 'reCAPTCHA token is missing' 
        });
      }

      // Verify with Google reCAPTCHA API
      const googleResponse = await axios.post(
        `https://www.google.com/recaptcha/api/siteverify?secret=${secretKey}&response=${token}`
      );

      if (googleResponse.data.success) {
        // Check if this is reCAPTCHA v3 (has score property)
        if (googleResponse.data.score !== undefined) {
          // reCAPTCHA v3 - check the score (0.0 is very likely a bot, 1.0 is very likely a human)
          const score = googleResponse.data.score || 0.0;
          const action = googleResponse.data.action || 'submit';
          
          // Set threshold for v3 (0.5 is a good balance)
          const threshold = 0.5;
          
          if (score >= threshold) {
            // Log successful verification
            console.log('reCAPTCHA v3 verification successful for IP:', req.ip, 'Score:', score, 'Action:', action);
            
            return res.status(200).json({ 
              success: true, 
              message: 'reCAPTCHA v3 verification passed',
              score: score,
              action: action,
              version: 'v3'
            });
          } else {
            // Score too low - likely a bot
            console.log('reCAPTCHA v3 verification failed - low score for IP:', req.ip, 'Score:', score, 'Action:', action);
            
            return res.status(400).json({ 
              success: false, 
              message: 'reCAPTCHA v3 verification failed - suspicious activity detected',
              score: score,
              action: action,
              errors: ['low-score']
            });
          }
        } else {
          // reCAPTCHA v2 - success means user completed the challenge
          console.log('reCAPTCHA v2 verification successful for IP:', req.ip);
          
          return res.status(200).json({ 
            success: true, 
            message: 'reCAPTCHA v2 verification passed',
            version: 'v2'
          });
        }
      } else {
        // Log failed verification
        console.log('reCAPTCHA verification failed for IP:', req.ip, 'Errors:', googleResponse.data['error-codes']);
        
        return res.status(400).json({ 
          success: false, 
          message: 'reCAPTCHA verification failed',
          errors: googleResponse.data['error-codes'] || []
        });
      }
    } catch (err) {
      console.error('reCAPTCHA verification error:', err.message);
      return res.status(500).json({ 
        success: false, 
        message: 'Server error during reCAPTCHA verification' 
      });
    }
  });
}

module.exports = { setupRecaptchaEndpoint }; 