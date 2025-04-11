// dosReportingAPI.js
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const { ethers } = require('ethers');
const DosAttackLogger = require('../client/src/contracts/DosAttackLogger.json');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(bodyParser.json());

// FIXED: Private key format - removed 0x prefix for ethers v6
const PRIVATE_KEY = process.env.PRIVATE_KEY;
const CONTRACT_ADDRESS = process.env.DOS_ATTACK_LOGGER_ADDRESS;

// Configure blockchain connection - compatible with ethers v6
const provider = new ethers.JsonRpcProvider('http://127.0.0.1:7545');
const signer = new ethers.Wallet(PRIVATE_KEY, provider);

// Add error handling for contract connectivity
let contract;
try {
  contract = new ethers.Contract(CONTRACT_ADDRESS, DosAttackLogger.abi, signer);
  console.log('Successfully created contract instance');
} catch (error) {
  console.error('Error creating contract instance:', error);
}

// Validate IP address
function isValidIPAddress(ip) {
    const ipPattern = /^(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
    return ipPattern.test(ip);
}

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'DoS Reporting API is running' });
});

// Get contract address endpoint
app.get('/api/contract-address', (req, res) => {
  res.json({ 
    address: CONTRACT_ADDRESS,
    isContract: contract ? true : false
  });
});

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
        if (!contract) {
          return res.status(500).json({ error: 'Contract not initialized' });
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
        const tx = await contract.logAttack(
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

// Get all attacks endpoint
app.get('/api/attacks', async (req, res) => {
    try {
        // Check if contract is available
        if (!contract) {
          return res.status(500).json({ error: 'Contract not initialized' });
        }

        // Verify contract connectivity first
        try {
            const code = await provider.getCode(CONTRACT_ADDRESS);
            if (code === '0x') {
                return res.status(500).json({ 
                    error: 'No contract deployed at the specified address',
                    address: CONTRACT_ADDRESS 
                });
            }
        } catch (error) {
            return res.status(500).json({ 
                error: 'Failed to check contract code',
                details: error.message
            });
        }

        const attackCount = await contract.attackCount();
        const attacks = [];

        for (let i = 1; i <= Number(attackCount); i++) {
            try {
                const attack = await contract.getAttack(i);
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

// Update attack status endpoint
app.put('/api/attacks/:id/status', async (req, res) => {
    try {
        const { id } = req.params;
        const { status } = req.body;

        // Check if contract is available
        if (!contract) {
          return res.status(500).json({ error: 'Contract not initialized' });
        }

        if (status === undefined || status < 0 || status > 3) {
            return res.status(400).json({ error: 'Invalid status value' });
        }

        const tx = await contract.updateAttackStatus(id, status);
        await tx.wait();

        res.json({ message: 'Attack status updated successfully' });
    } catch (error) {
        console.error('Error updating attack status:', error);
        res.status(500).json({ error: 'Failed to update attack status', details: error.message });
    }
});

// Start server
app.listen(PORT, () => {
    console.log(`DoS Reporting API running on port ${PORT}`);
    console.log(`Contract address: ${CONTRACT_ADDRESS}`);
    
    // Verify contract on startup
    provider.getCode(CONTRACT_ADDRESS).then(code => {
        if (code === '0x') {
            console.error('WARNING: No contract deployed at the specified address!');
            console.log('Please deploy the contract and restart the server.');
        } else {
            console.log('Contract verified at the specified address.');
        }
    }).catch(error => {
        console.error('Error verifying contract:', error);
    });
});

module.exports = app; // For testing purposes