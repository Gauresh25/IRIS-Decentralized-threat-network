# IRIS - Decentralized Threat Intelligence Sharing Network

A blockchain-based threat intelligence sharing platform built with Ethereum smart contracts, Solidity, and React. IRIS allows security professionals to share, track, and respond to security threats in a decentralized, immutable manner.

## 📋 Overview

IRIS leverages blockchain technology to create a trusted, tamper-proof environment for sharing security threat intelligence. The platform enables:

- Decentralized logging and tracking of security threats
- Immutable threat records on the Ethereum blockchain
- Severity-based classification of threats
- Community verification and resolution tracking
- Transparent threat intelligence sharing

## 🔧 Technologies Used

- **Blockchain**: Ethereum
- **Smart Contract Language**: Solidity
- **Development Framework**: Truffle
- **Frontend**: React, Tailwind CSS
- **Web3 Integration**: ethers.js
- **Local Blockchain**: Ganache

## 🚀 Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) (v12.0 or higher)
- [Truffle](https://www.trufflesuite.com/truffle) (`npm install -g truffle`)
- [Ganache](https://www.trufflesuite.com/ganache) - Local Ethereum blockchain
- [MetaMask](https://metamask.io/) browser extension

### Installation

1. Clone the repository:
   ```
   git clone [https://github.com/yourusername/IRIS.git](https://github.com/Gauresh25/IRIS-Decentralized-threat-network)
   cd IRIS
   ```

2. Install dependencies:
   ```
   npm install
   ```

3. Start Ganache and ensure it's running on port 7545

4. Compile and migrate the smart contracts:
   ```
   truffle compile
   truffle migrate
   ```

5. Start the development server:
   ```
   npm start
   ```

6. Connect MetaMask to your local Ganache blockchain:
   - Network Name: Ganache
   - RPC URL: http://127.0.0.1:7545
   - Chain ID: 1337
   - Currency Symbol: ETH

## 📁 Project Structure

```
IRIS/
├── contracts/              # Solidity smart contracts
│   ├── Migrations.sol      # Standard Truffle migrations contract
│   └── ThreatList.sol      # Threat tracking smart contract (based on TodoList structure)
├── migrations/             # Truffle migration scripts
├── src/                    # React frontend application
│   ├── components/         # React components
│   │   └── ThreatMonitor.jsx # Threat monitoring interface
│   └── ...
├── truffle-config.js       # Truffle configuration
└── ...
```

## 🔍 Smart Contracts

The project currently uses a basic task structure that has been repurposed for threat tracking. The existing smart contract stores threat information with the following properties:
- ID
- Content (threat description)
- Status (resolved/unresolved)

## 🔒 Threat Monitoring System

The ThreatMonitor component provides a user interface for:

- Logging new security threats with detailed descriptions
- Automatic severity classification based on keywords
- Visual indicators for threat severity (red for high, yellow for medium)
- Tracking resolution status of threats
- Real-time updates using blockchain events

## 🛡️ Key Features

- **Decentralized Architecture**: No central authority controls the threat data
- **Immutability**: Once recorded, threat information cannot be altered
- **Transparency**: All participants can view the full threat history
- **Blockchain Security**: Leverages Ethereum's security model
- **User-Friendly Interface**: Easy to log and track threats

## 🛠️ Future Enhancements

- Enhanced threat categorization (APT, malware, phishing, etc.)
- Reputation system for threat reporters
- Integration with external threat feeds
- Advanced filtering and search capabilities
- Threat correlation analysis
- Private sharing options for sensitive threats
- Mobile application support

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## ⚠️ Disclaimer

This application is currently under development. While functional for demonstration purposes, additional security measures and features would be necessary for production deployment.
