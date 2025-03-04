import React, { useState, useEffect } from 'react';
import { ethers } from 'ethers';
import { Shield, AlertTriangle, CheckCircle, Loader } from 'lucide-react';
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

// Contract ABI definition with detailed comments for each function
const TodoList = {
  abi: [
    {
      "constant": true,
      "inputs": [{"name": "", "type": "uint256"}],
      "name": "tasks",
      "outputs": [
        {"name": "id", "type": "uint256"},
        {"name": "content", "type": "string"},
        {"name": "completed", "type": "bool"}
      ],
      "payable": false,
      "stateMutability": "view",
      "type": "function"
    },
    {
      "constant": true,
      "inputs": [],
      "name": "taskCount",
      "outputs": [{"name": "", "type": "uint256"}],
      "payable": false,
      "stateMutability": "view",
      "type": "function"
    },
    {
      "inputs": [],
      "payable": false,
      "stateMutability": "nonpayable",
      "type": "constructor"
    },
    {
      "constant": false,
      "inputs": [{"name": "_content", "type": "string"}],
      "name": "createTask",
      "outputs": [],
      "payable": false,
      "stateMutability": "nonpayable",
      "type": "function"
    }
  ]
};

const ThreatMonitor = () => {
  // State management with clear purposes
  const [threats, setThreats] = useState([]);
  const [newThreat, setNewThreat] = useState('');
  const [loading, setLoading] = useState(true);
  const [contract, setContract] = useState(null);
  const [connectionStatus, setConnectionStatus] = useState('disconnected');
  const [account, setAccount] = useState(null);

  // Initialize blockchain connection on component mount
  useEffect(() => {
    initializeEthereum();

    // Set up MetaMask account change listener
    if (window.ethereum) {
      window.ethereum.on('accountsChanged', handleAccountChange);
      window.ethereum.on('chainChanged', handleChainChange);
    }

    // Cleanup listeners on component unmount
    return () => {
      if (window.ethereum) {
        window.ethereum.removeListener('accountsChanged', handleAccountChange);
        window.ethereum.removeListener('chainChanged', handleChainChange);
      }
    };
  }, []);

  // Load threats whenever the contract or account changes
  useEffect(() => {
    if (contract && account) {
      loadThreats();
    }
  }, [contract, account]);

  // Handle MetaMask account changes
  const handleAccountChange = async (accounts) => {
    if (accounts.length === 0) {
      setConnectionStatus('disconnected');
      setAccount(null);
      setContract(null);
    } else {
      setAccount(accounts[0]);
      await initializeEthereum();
    }
  };

  // Handle blockchain network changes
  const handleChainChange = () => {
    window.location.reload();
  };

  // Initialize Ethereum connection with comprehensive error handling
  const initializeEthereum = async () => {
    try {
      if (!window.ethereum) {
        toast.error('Please install MetaMask to use this application');
        setConnectionStatus('no-metamask');
        return;
      }
  
      setConnectionStatus('connecting');
  
      // First, verify network
      const provider = new ethers.providers.Web3Provider(window.ethereum);
      const network = await provider.getNetwork();
      
      if (network.chainId !== 1337) {
        toast.error(`Please connect to Ganache (Chain ID 1337). Currently on ${network.chainId}`);
        setConnectionStatus('wrong-network');
        return;
      }
  
      // Request account access
      const accounts = await window.ethereum.request({ 
        method: 'eth_requestAccounts' 
      });
      
      if (!accounts || accounts.length === 0) {
        toast.error('Please connect your MetaMask account');
        setConnectionStatus('disconnected');
        return;
      }
  
      setAccount(accounts[0]);
      const signer = provider.getSigner();
  
      // Get your latest deployed contract address from truffle migrate
      const contractAddress = '0xCef5B1996ac31bF1D399E85607100c92d9347c49';
      
      // Create contract instance with additional verification
      const threatContract = new ethers.Contract(
        contractAddress,
        TodoList.abi,
        signer
      );
  
      // Verify contract connection
      try {
        const code = await provider.getCode(contractAddress);
        if (code === '0x') {
          toast.error('No contract deployed at this address');
          return;
        }
  
        const count = await threatContract.taskCount();
        console.log('Connected to contract, task count:', count.toString());
        setContract(threatContract);
        setConnectionStatus('connected');
      } catch (error) {
        console.error('Contract verification failed:', error);
        toast.error('Contract verification failed. Please check deployment.');
        setConnectionStatus('contract-error');
      }
  
    } catch (err) {
      console.error('Ethereum initialization error:', err);
      toast.error('Failed to connect to Ethereum network');
      setConnectionStatus('error');
    }
  };
  // Load threats with error handling and loading states
  const loadThreats = async () => {
    if (!contract || !account) {
      console.log('Contract or account not initialized');
      return;
    }

    try {
      setLoading(true);
      const count = await contract.taskCount();
      const loadedThreats = [];
      
      for (let i = 1; i <= count; i++) {
        try {
          const threat = await contract.tasks(i);
          loadedThreats.push({
            id: threat.id.toNumber(),
            content: threat.content,
            resolved: threat.completed,
            severity: getThreatSeverity(threat.content)
          });
        } catch (error) {
          console.error(`Error loading threat ${i}:`, error);
          toast.error(`Failed to load threat #${i}`);
        }
      }
      
      setThreats(loadedThreats);
    } catch (err) {
      console.error('Failed to load threats:', err);
      toast.error('Failed to load threats');
    } finally {
      setLoading(false);
    }
  };

  // Add new threat with transaction monitoring
  const addThreat = async () => {
    if (!newThreat.trim() || !contract) return;

    try {
      setLoading(true);
      const tx = await contract.createTask(newThreat);
      
      // Wait for transaction confirmation and show progress
      toast.info('Transaction submitted. Waiting for confirmation...');
      await tx.wait();
      
      toast.success('Threat logged successfully');
      setNewThreat('');
      await loadThreats();
    } catch (err) {
      console.error('Failed to add threat:', err);
      toast.error(err.message || 'Failed to add threat');
    } finally {
      setLoading(false);
    }
  };

  // Determine threat severity based on content
  const getThreatSeverity = (content) => {
    const severityKeywords = {
      critical: ['critical', 'severe', 'extreme', 'emergency'],
      high: ['high', 'urgent', 'important'],
      medium: ['medium', 'moderate', 'attention'],
      low: ['low', 'minor', 'trivial']
    };

    for (const [level, keywords] of Object.entries(severityKeywords)) {
      if (keywords.some(keyword => content.toLowerCase().includes(keyword))) {
        return level;
      }
    }
    return 'medium';
  };

  // Get appropriate color for threat severity
  const getSeverityColor = (severity) => {
    const colors = {
      critical: 'bg-red-600',
      high: 'bg-red-500',
      medium: 'bg-yellow-500',
      low: 'bg-blue-500'
    };
    return colors[severity] || colors.medium;
  };

  // Render loading state
  if (connectionStatus !== 'connected' && loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <Loader className="w-8 h-8 animate-spin mx-auto mb-4 text-blue-600" />
          <p className="text-gray-600">Connecting to blockchain...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="bg-white rounded-lg shadow-lg p-6 mb-8">
        {/* Header section */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            <Shield className="w-6 h-6 text-blue-600" />
            <h1 className="text-2xl font-bold text-gray-800">
              Threat Monitoring System
            </h1>
          </div>
          <div className="flex items-center gap-2">
            <div className={`h-2 w-2 rounded-full ${
              connectionStatus === 'connected' ? 'bg-green-500' : 'bg-red-500'
            }`} />
            <span className="text-sm text-gray-600">
              {account ? `Connected: ${account.slice(0, 6)}...${account.slice(-4)}` : 'Not Connected'}
            </span>
          </div>
        </div>

        {/* Input section */}
        <div className="flex gap-4 mb-8">
          <input
            type="text"
            value={newThreat}
            onChange={(e) => setNewThreat(e.target.value)}
            placeholder="Enter new threat details..."
            className="flex-grow px-4 py-2 border border-gray-300 rounded-lg 
                     focus:outline-none focus:ring-2 focus:ring-blue-500"
            disabled={!contract || loading}
          />
          <button 
            onClick={addThreat}
            disabled={loading || !newThreat.trim() || !contract}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 
                     disabled:opacity-50 disabled:cursor-not-allowed transition-colors
                     flex items-center gap-2"
          >
            {loading && <Loader className="w-4 h-4 animate-spin" />}
            Log Threat
          </button>
        </div>

        {/* Threats list */}
        <div className="space-y-4">
          {threats.map((threat) => (
            <div 
              key={threat.id}
              className="relative border border-gray-200 rounded-lg p-4 
                       hover:shadow-md transition-shadow"
            >
              <div className={`absolute top-0 left-0 w-1 h-full rounded-l-lg 
                            ${getSeverityColor(threat.severity)}`} />
              
              <div className="ml-3">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-lg font-medium text-gray-800">
                    Threat #{threat.id}
                  </h3>
                  {threat.resolved && (
                    <div className="flex items-center text-green-500">
                      <CheckCircle className="w-5 h-5 mr-1" />
                      <span>Resolved</span>
                    </div>
                  )}
                </div>
                <p className="text-gray-600">{threat.content}</p>
                <div className="mt-2">
                  <span className={`inline-flex items-center px-2 py-1 rounded text-sm
                                ${getSeverityColor(threat.severity)} text-white`}>
                    {threat.severity.charAt(0).toUpperCase() + threat.severity.slice(1)}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
      
      <ToastContainer 
        position="bottom-right"
        autoClose={5000}
        hideProgressBar={false}
        newestOnTop
        closeOnClick
        rtl={false}
        pauseOnFocusLoss
        draggable
        pauseOnHover
      />
    </div>
  );
};

export default ThreatMonitor;