// dosReportingAPI.js
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const { ethers } = require('ethers');
const DosAttackLogger = require('../client/src/contracts/DosAttackLogger.json');

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(bodyParser.json());

// Load environment variables - in production use dotenv
const PRIVATE_KEY = process.env.PRIVATE_KEY || '0xbdd79fd75e7bfa31adc12372dfbc14142c8efe0b2c9b8d6e2310255fd8b4c2cc';
const CONTRACT_ADDRESS = process.env.CONTRACT_ADDRESS || '0xe609FDf051E7C3113d6b3246C604971bB384f7D7';

// Configure blockchain connection - compatible with ethers v6
const provider = new ethers.JsonRpcProvider('http://127.0.0.1:7545');
const signer = new ethers.Wallet(PRIVATE_KEY, provider);
const contract = new ethers.Contract(CONTRACT_ADDRESS, DosAttackLogger.abi, signer);

// Validate IP address
function isValidIPAddress(ip) {
    const ipPattern = /^(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
    return ipPattern.test(ip);
}

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
        res.status(500).json({ error: 'Failed to report attack' });
    }
});

// Get all attacks endpoint
app.get('/api/attacks', async (req, res) => {
    try {
        const attackCount = await contract.attackCount();
        const attacks = [];

        for (let i = 1; i <= attackCount; i++) {
            const attack = await contract.getAttack(i);
            attacks.push({
                id: attack.id.toString(),
                sourceIP: attack.sourceIP,
                targetService: attack.targetService,
                timestamp: new Date(Number(attack.timestamp) * 1000).toISOString(),
                attackType: ['SYNFLOOD', 'UDPFLOOD', 'HTTPFLOOD', 'ICMPFLOOD', 'SLOWLORIS', 'OTHER'][attack.attackType],
                trafficVolume: attack.trafficVolume.toString(),
                duration: attack.duration.toString(),
                additionalInfo: attack.additionalInfo,
                status: ['ACTIVE', 'MITIGATED', 'INVESTIGATING', 'CLOSED'][attack.status]
            });
        }

        res.json(attacks);
    } catch (error) {
        console.error('Error fetching attacks:', error);
        res.status(500).json({ error: 'Failed to fetch attacks' });
    }
});

// Update attack status endpoint
app.put('/api/attacks/:id/status', async (req, res) => {
    try {
        const { id } = req.params;
        const { status } = req.body;

        if (status === undefined || status < 0 || status > 3) {
            return res.status(400).json({ error: 'Invalid status value' });
        }

        const tx = await contract.updateAttackStatus(id, status);
        await tx.wait();

        res.json({ message: 'Attack status updated successfully' });
    } catch (error) {
        console.error('Error updating attack status:', error);
        res.status(500).json({ error: 'Failed to update attack status' });
    }
});

// Start server
app.listen(PORT, () => {
    console.log(`DoS Reporting API running on port ${PORT}`);
});

module.exports = app; // For testing purposes