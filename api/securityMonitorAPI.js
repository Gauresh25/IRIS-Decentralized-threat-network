// securityMonitorAPI.js - Combined API for DoS and Phishing monitoring
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const { ethers } = require('ethers');
const DosAttackLogger = require('../client/src/contracts/DosAttackLogger.json');
const PhishingAttackLogger = require('../client/src/contracts/SimplifiedPhishingLogger.json');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(bodyParser.json());

// Environment variables
const PRIVATE_KEY = process.env.PRIVATE_KEY;
const DOS_CONTRACT_ADDRESS = process.env.DOS_ATTACK_LOGGER_ADDRESS;
const PHISHING_CONTRACT_ADDRESS = process.env.PHISHING_ATTACK_LOGGER_ADDRESS;

// Configure blockchain connection
const provider = new ethers.JsonRpcProvider('http://127.0.0.1:7545');
const signer = new ethers.Wallet(PRIVATE_KEY, provider);

// Initialize contracts
let dosContract;
let phishingContract;

try {
  dosContract = new ethers.Contract(DOS_CONTRACT_ADDRESS, DosAttackLogger.abi, signer);
  console.log('Successfully created DoS contract instance');
} catch (error) {
  console.error('Error creating DoS contract instance:', error);
}

try {
  phishingContract = new ethers.Contract(PHISHING_CONTRACT_ADDRESS, PhishingAttackLogger.abi, signer);
  console.log('Successfully created Phishing contract instance');
} catch (error) {
  console.error('Error creating Phishing contract instance:', error);
}

// Validation functions
function isValidIPAddress(ip) {
  const ipPattern = /^(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
  return ipPattern.test(ip);
}

function isValidEmail(email) {
  const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailPattern.test(email);
}

function isValidURL(url) {
  try {
    new URL(url);
    return true;
  } catch (e) {
    return false;
  }
}

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    message: 'Security Monitoring API is running',
    services: {
      dos: dosContract ? 'available' : 'unavailable',
      phishing: phishingContract ? 'available' : 'unavailable'
    }
  });
});

// Get contract addresses endpoint
app.get('/api/contract-addresses', (req, res) => {
  res.json({ 
    dos: {
      address: DOS_CONTRACT_ADDRESS,
      isContract: dosContract ? true : false
    },
    phishing: {
      address: PHISHING_CONTRACT_ADDRESS,
      isContract: phishingContract ? true : false
    }
  });
});

// ==================== DoS Attack Endpoints ====================

// Report DoS attack endpoint
app.post('/api/report-attack', async (req, res) => {
  try {
    const {
      sourceIP,
      targetService,
      attackType,
      trafficVolume,
      duration,
      additionalInfo
    } = req.body;

    // Check if contract is available
    if (!dosContract) {
      return res.status(500).json({ error: 'DoS contract not initialized' });
    }

    // Validate required fields
    if (!sourceIP || !targetService || attackType === undefined) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Validate IP
    if (!isValidIPAddress(sourceIP)) {
      return res.status(400).json({ error: 'Invalid source IP address' });
    }

    // Convert attack type to integer
    const attackTypeMap = {
      'synflood': 0,
      'udpflood': 1,
      'httpflood': 2,
      'icmpflood': 3,
      'slowloris': 4,
      'other': 5
    };

    const attackTypeValue = attackTypeMap[attackType.toLowerCase()] || 5;
    const timestamp = Math.floor(Date.now() / 1000);

    // Log to blockchain
    const tx = await dosContract.logAttack(
      sourceIP,
      targetService,
      timestamp,
      attackTypeValue,
      trafficVolume || 0,
      duration || 0,
      additionalInfo || ''
    );

    await tx.wait();

    // Return success
    res.status(201).json({
      message: 'Attack successfully reported',
      txHash: tx.hash
    });

  } catch (error) {
    console.error('Error reporting attack:', error);
    res.status(500).json({ error: 'Failed to report attack', details: error.message });
  }
});

// Get all DoS attacks endpoint
app.get('/api/attacks', async (req, res) => {
  try {
    // Check if contract is available
    if (!dosContract) {
      return res.status(500).json({ error: 'DoS contract not initialized' });
    }

    // Verify contract connectivity first
    try {
      const code = await provider.getCode(DOS_CONTRACT_ADDRESS);
      if (code === '0x') {
        return res.status(500).json({ 
          error: 'No contract deployed at the specified address',
          address: DOS_CONTRACT_ADDRESS 
        });
      }
    } catch (error) {
      return res.status(500).json({ 
        error: 'Failed to check contract code',
        details: error.message
      });
    }

    const attackCount = await dosContract.attackCount();
    const attacks = [];

    for (let i = 1; i <= Number(attackCount); i++) {
      try {
        const attack = await dosContract.getAttack(i);
        attacks.push({
          id: attack[0].toString(),
          sourceIP: attack[1],
          targetService: attack[2],
          timestamp: new Date(Number(attack[3]) * 1000).toISOString(),
          attackType: ['SYNFLOOD', 'UDPFLOOD', 'HTTPFLOOD', 'ICMPFLOOD', 'SLOWLORIS', 'OTHER'][Number(attack[4])],
          trafficVolume: attack[5].toString(),
          duration: attack[6].toString(),
          additionalInfo: attack[7],
          status: ['ACTIVE', 'MITIGATED', 'INVESTIGATING', 'CLOSED'][Number(attack[8])]
        });
      } catch (error) {
        console.error(`Error fetching attack ${i}:`, error);
      }
    }

    res.json(attacks);
  } catch (error) {
    console.error('Error fetching attacks:', error);
    res.status(500).json({ error: 'Failed to fetch attacks', details: error.message });
  }
});

// Update DoS attack status endpoint
app.put('/api/attacks/:id/status', async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    // Check if contract is available
    if (!dosContract) {
      return res.status(500).json({ error: 'DoS contract not initialized' });
    }

    if (status === undefined || status < 0 || status > 3) {
      return res.status(400).json({ error: 'Invalid status value' });
    }

    const tx = await dosContract.updateAttackStatus(id, status);
    await tx.wait();

    res.json({ message: 'Attack status updated successfully' });
  } catch (error) {
    console.error('Error updating attack status:', error);
    res.status(500).json({ error: 'Failed to update attack status', details: error.message });
  }
});

// ==================== Phishing Attack Endpoints ====================

// Report phishing attempt endpoint
// Report phishing attempt endpoint - Simplified version
app.post('/api/report-phishing', async (req, res) => {
  try {
    const {
      sourceEmail,
      targetDomain,
      phishingType,
      severity,
      contentHash
    } = req.body;

    // Check if contract is available
    if (!phishingContract) {
      return res.status(500).json({ error: 'Phishing contract not initialized' });
    }

    // Validate required fields
    if (!sourceEmail || !targetDomain || phishingType === undefined || severity === undefined) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Validate email
    if (!isValidEmail(sourceEmail)) {
      return res.status(400).json({ error: 'Invalid source email address' });
    }

    // Validate severity
    if (severity < 1 || severity > 5) {
      return res.status(400).json({ error: 'Severity must be between 1 and 5' });
    }

    // Convert phishing type to integer
    const phishingTypeMap = {
      'credential_theft': 0,
      'financial_scam': 1,
      'data_theft': 2,
      'malware_distribution': 3,
      'social_engineering': 4,
      'other': 5
    };

    const phishingTypeValue = phishingTypeMap[phishingType.toLowerCase()] || 5;

    // Log to blockchain
    const tx = await phishingContract.logPhishingAttempt(
      sourceEmail,
      targetDomain,
      phishingTypeValue,
      severity,
      contentHash || `hash-${Date.now()}`
    );

    await tx.wait();

    // Return success
    res.status(201).json({
      message: 'Phishing attempt successfully reported',
      txHash: tx.hash
    });

  } catch (error) {
    console.error('Error reporting phishing attempt:', error);
    res.status(500).json({ error: 'Failed to report phishing attempt', details: error.message });
  }
});

// Get all phishing attempts endpoint
// Get all phishing attempts endpoint - Simplified version
app.get('/api/phishing-attempts', async (req, res) => {
  try {
    // Check if contract is available
    if (!phishingContract) {
      return res.status(500).json({ error: 'Phishing contract not initialized' });
    }

    // Verify contract connectivity first
    try {
      const code = await provider.getCode(PHISHING_CONTRACT_ADDRESS);
      if (code === '0x') {
        return res.status(500).json({ 
          error: 'No contract deployed at the specified address',
          address: PHISHING_CONTRACT_ADDRESS 
        });
      }
    } catch (error) {
      return res.status(500).json({ 
        error: 'Failed to check contract code',
        details: error.message
      });
    }

    const attemptCount = await phishingContract.attemptCount();
    const attempts = [];

    for (let i = 1; i <= Number(attemptCount); i++) {
      try {
        const attempt = await phishingContract.getPhishingAttempt(i);
        attempts.push({
          id: attempt[0].toString(),
          sourceEmail: attempt[1],
          targetDomain: attempt[2],
          timestamp: new Date(Number(attempt[3]) * 1000).toISOString(),
          phishingType: ['CREDENTIAL_THEFT', 'FINANCIAL_SCAM', 'DATA_THEFT', 'MALWARE_DISTRIBUTION', 'SOCIAL_ENGINEERING', 'OTHER'][Number(attempt[4])],
          severity: Number(attempt[5]),
          contentHash: attempt[6],
          status: ['ACTIVE', 'MITIGATED', 'INVESTIGATING', 'CLOSED'][Number(attempt[7])]
        });
      } catch (error) {
        console.error(`Error fetching phishing attempt ${i}:`, error);
      }
    }

    res.json(attempts);
  } catch (error) {
    console.error('Error fetching phishing attempts:', error);
    res.status(500).json({ error: 'Failed to fetch phishing attempts', details: error.message });
  }
});

// Update phishing attempt status endpoint
app.put('/api/phishing-attempts/:id/status', async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    // Check if contract is available
    if (!phishingContract) {
      return res.status(500).json({ error: 'Phishing contract not initialized' });
    }

    if (status === undefined || status < 0 || status > 3) {
      return res.status(400).json({ error: 'Invalid status value' });
    }

    const tx = await phishingContract.updateAttemptStatus(id, status);
    await tx.wait();

    res.json({ message: 'Phishing attempt status updated successfully' });
  } catch (error) {
    console.error('Error updating phishing attempt status:', error);
    res.status(500).json({ error: 'Failed to update phishing attempt status', details: error.message });
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`Security Monitoring API running on port ${PORT}`);
  console.log(`DoS Contract address: ${DOS_CONTRACT_ADDRESS}`);
  console.log(`Phishing Contract address: ${PHISHING_CONTRACT_ADDRESS}`);
  
  // Verify contracts on startup
  provider.getCode(DOS_CONTRACT_ADDRESS).then(code => {
    if (code === '0x') {
      console.error('WARNING: No DoS contract deployed at the specified address!');
    } else {
      console.log('DoS contract verified at the specified address.');
    }
  }).catch(error => {
    console.error('Error verifying DoS contract:', error);
  });
  
  provider.getCode(PHISHING_CONTRACT_ADDRESS).then(code => {
    if (code === '0x') {
      console.error('WARNING: No Phishing contract deployed at the specified address!');
    } else {
      console.log('Phishing contract verified at the specified address.');
    }
  }).catch(error => {
    console.error('Error verifying Phishing contract:', error);
  });
});

module.exports = app;