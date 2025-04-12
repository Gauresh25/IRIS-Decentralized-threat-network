import React, { useState, useEffect } from 'react';
import { ethers } from 'ethers';
import { 
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  BarChart, Bar, PieChart, Pie, Cell
} from 'recharts';
import { 
  Shield, AlertTriangle, RefreshCw, Check, 
  Mail, ExternalLink, AlertOctagon, Search, Filter
} from 'lucide-react';
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

const SimplifiedPhishingLogger = {
  abi: [
    {
      "constant": true,
      "inputs": [],
      "name": "attemptCount",
      "outputs": [{"name": "", "type": "uint256"}],
      "payable": false,
      "stateMutability": "view",
      "type": "function"
    },
    {
      "constant": true,
      "inputs": [{"name": "", "type": "uint256"}],
      "name": "phishingAttempts",
      "outputs": [
        {"name": "id", "type": "uint256"},
        {"name": "sourceEmail", "type": "string"},
        {"name": "targetDomain", "type": "string"},
        {"name": "timestamp", "type": "uint256"},
        {"name": "phishingType", "type": "uint8"},
        {"name": "severity", "type": "uint256"},
        {"name": "contentHash", "type": "string"},
        {"name": "status", "type": "uint8"}
      ],
      "payable": false,
      "stateMutability": "view",
      "type": "function"
    },
    {
      "constant": false,
      "inputs": [
        {"name": "_sourceEmail", "type": "string"},
        {"name": "_targetDomain", "type": "string"},
        {"name": "_phishingType", "type": "uint256"},
        {"name": "_severity", "type": "uint256"},
        {"name": "_contentHash", "type": "string"}
      ],
      "name": "logPhishingAttempt",
      "outputs": [],
      "payable": false,
      "stateMutability": "nonpayable",
      "type": "function"
    },
    {
      "constant": false,
      "inputs": [
        {"name": "_id", "type": "uint256"},
        {"name": "_newStatus", "type": "uint256"}
      ],
      "name": "updateAttemptStatus",
      "outputs": [],
      "payable": false,
      "stateMutability": "nonpayable",
      "type": "function"
    },
    {
      "constant": true,
      "inputs": [
        {"name": "_id", "type": "uint256"}
      ],
      "name": "getPhishingAttempt",
      "outputs": [
        {"name": "id", "type": "uint256"},
        {"name": "sourceEmail", "type": "string"},
        {"name": "targetDomain", "type": "string"},
        {"name": "timestamp", "type": "uint256"},
        {"name": "phishingType", "type": "uint256"},
        {"name": "severity", "type": "uint256"},
        {"name": "contentHash", "type": "string"},
        {"name": "status", "type": "uint256"}
      ],
      "payable": false,
      "stateMutability": "view",
      "type": "function"
    }
  ]
};

const PhishingMonitor = () => {
  // State management
  const [attempts, setAttempts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [formLoading, setFormLoading] = useState(false);
  const [contract, setContract] = useState(null);
  const [connectionStatus, setConnectionStatus] = useState('disconnected');
  const [account, setAccount] = useState(null);
  const [selectedTimeRange, setSelectedTimeRange] = useState('24h');
  const [statsData, setStatsData] = useState({
    totalAttempts: 0,
    activeAttempts: 0,
    mitigatedAttempts: 0,
    averageSeverity: 0,
    phishingTypes: [],
    timelineData: []
  });

  // Form state
  const [formData, setFormData] = useState({
    sourceEmail: '',
    targetDomain: '',
    phishingType: 'credential_theft',
    severity: 3,
    emailSubject: '',
    maliciousURL: '',
    contentHash: '',
    additionalInfo: ''
  });

  // Form validity state
  const [formErrors, setFormErrors] = useState({
    sourceEmail: '',
    targetDomain: '',
    maliciousURL: ''
  });

  // Initialize blockchain connection
  useEffect(() => {
    initializeBlockchain();
    
    if (window.ethereum) {
      window.ethereum.on('accountsChanged', handleAccountChange);
      window.ethereum.on('chainChanged', () => window.location.reload());
    }
    
    return () => {
      if (window.ethereum) {
        window.ethereum.removeListener('accountsChanged', handleAccountChange);
      }
    };
  }, []);

  // Load attempts when contract is ready
  useEffect(() => {
    if (contract && account) {
      loadPhishingAttempts();
      
      // Set up auto-refresh every 30 seconds
      const interval = setInterval(() => {
        loadPhishingAttempts();
      }, 30000);
      
      return () => clearInterval(interval);
    }
  }, [contract, account]);

  // Process attempt data for stats when attempts change
  useEffect(() => {
    if (attempts.length > 0) {
      processAttemptStats();
    }
  }, [attempts, selectedTimeRange]);

  const handleAccountChange = async (accounts) => {
    if (accounts.length === 0) {
      setConnectionStatus('disconnected');
      setAccount(null);
    } else {
      setAccount(accounts[0]);
      await initializeBlockchain();
    }
  };

  const initializeBlockchain = async () => {
    try {
      if (!window.ethereum) {
        toast.error('Please install MetaMask to use this application');
        setConnectionStatus('no-metamask');
        setLoading(false);
        return;
      }
      
      setConnectionStatus('connecting');
      
      // Updated for ethers v6
      const provider = new ethers.BrowserProvider(window.ethereum);
      
      try {
        const network = await provider.getNetwork();
        
        // Chain ID is accessed differently in v6
        const chainId = parseInt(network.chainId);
        
        if (chainId !== 1337) {
          toast.error(`Please connect to Ganache (Chain ID 1337). Currently on chain ID ${chainId}`);
          setConnectionStatus('wrong-network');
          setLoading(false);
          return;
        }
        
        const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
        
        if (!accounts || accounts.length === 0) {
          toast.error('Please connect your MetaMask account');
          setConnectionStatus('disconnected');
          setLoading(false);
          return;
        }
        
        setAccount(accounts[0]);
        const signer = await provider.getSigner();
        
        // Your deployed contract address
        const contractAddress = import.meta.env.VITE_PHISHING_ATTACK_LOGGER_ADDRESS;
        console.log('Contract address:', contractAddress);
        
        const phishingContract = new ethers.Contract(
          contractAddress,
          PhishingAttackLogger.abi,
          signer
        );
        
        // Check if connected properly
        try {
          // First check if there's any code at the address
          const code = await provider.getCode(contractAddress);
          console.log('Code at address:', code);
          
          if (code === '0x') {
            console.error('No contract deployed at this address');
            toast.error('No contract found at the specified address');
            setConnectionStatus('no-contract');
            return;
          }
          
          // Try manually calling the function to see raw response
          const data = phishingContract.interface.encodeFunctionData("attemptCount");
          console.log('Encoded function data:', data);
          
          const rawResult = await provider.call({
            to: contractAddress,
            data: data
          });
          console.log('Raw call result:', rawResult);
          
          // Now try the regular method call
          const count = await phishingContract.attemptCount();
          console.log('Connected to Phishing Attack Logger, attempt count:', count.toString());
          setContract(phishingContract);
          setConnectionStatus('connected');
        } catch (error) {
          console.error('Contract connection error:', error);
          toast.error('Failed to connect to the Phishing Attack Logger contract');
          setConnectionStatus('contract-error');
        }
      } catch (error) {
        console.error('Network error:', error);
        toast.error('Failed to connect to the network');
        setConnectionStatus('network-error');
      }
    } catch (error) {
      console.error('Blockchain initialization error:', error);
      toast.error('Failed to connect to blockchain');
      setConnectionStatus('error');
    } finally {
      setLoading(false);
    }
  };

  const loadPhishingAttempts = async () => {
    if (!contract) return;
    
    try {
      setLoading(true);
      
      // Call API instead of direct contract interaction for better performance
      const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:3001'}/api/phishing-attempts`);
      
      if (!response.ok) {
        throw new Error(`API responded with status ${response.status}`);
      }
      
      const attemptData = await response.json();
      
      // Sort by timestamp (newest first)
      attemptData.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
      setAttempts(attemptData);
      
    } catch (error) {
      console.error('Failed to load phishing attempts:', error);
      toast.error('Error loading phishing attempt data');
      
      // Fallback to direct contract interaction if API fails
      try {
        const count = await contract.attemptCount();
        const attemptData = [];
        
        for (let i = 1; i <= Number(count); i++) {
          try {
            const attempt = await contract.getPhishingAttempt(i);
            attemptData.push({
              id: Number(attempt[0]),
              sourceEmail: attempt[1],
              targetDomain: attempt[2],
              timestamp: new Date(Number(attempt[3]) * 1000).toISOString(),
              phishingType: ['CREDENTIAL_THEFT', 'FINANCIAL_SCAM', 'DATA_THEFT', 'MALWARE_DISTRIBUTION', 'SOCIAL_ENGINEERING', 'OTHER'][Number(attempt[4])],
              severity: Number(attempt[5]),
              emailSubject: attempt[6],
              maliciousURL: attempt[7],
              contentHash: attempt[8],
              additionalInfo: attempt[9],
              status: ['ACTIVE', 'MITIGATED', 'INVESTIGATING', 'CLOSED'][Number(attempt[10])]
            });
          } catch (error) {
            console.error(`Error loading attempt ${i}:`, error);
          }
        }
        
        // Sort by timestamp (newest first)
        attemptData.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
        setAttempts(attemptData);
      } catch (error) {
        console.error('Direct contract interaction also failed:', error);
      }
    } finally {
      setLoading(false);
    }
  };

  const processAttemptStats = () => {
    // Filter attempts based on selected time range
    const now = new Date();
    const filtered = attempts.filter(attempt => {
      const attemptDate = new Date(attempt.timestamp);
      if (selectedTimeRange === '24h') {
        return (now - attemptDate) < 24 * 60 * 60 * 1000;
      } else if (selectedTimeRange === '7d') {
        return (now - attemptDate) < 7 * 24 * 60 * 60 * 1000;
      } else if (selectedTimeRange === '30d') {
        return (now - attemptDate) < 30 * 24 * 60 * 60 * 1000;
      }
      return true; // 'all' case
    });
    
    // Calculate stats
    const activeAttempts = filtered.filter(a => a.status === 'ACTIVE').length;
    const mitigatedAttempts = filtered.filter(a => a.status === 'MITIGATED').length;
    
    // Calculate average severity
    const totalSeverity = filtered.reduce((sum, attempt) => sum + attempt.severity, 0);
    const avgSeverity = filtered.length > 0 ? (totalSeverity / filtered.length).toFixed(1) : 0;
    
    // Count phishing types
    const typeCounter = {};
    filtered.forEach(attempt => {
      typeCounter[attempt.phishingType] = (typeCounter[attempt.phishingType] || 0) + 1;
    });
    
    // Prepare data for pie chart
    const phishingTypesData = Object.keys(typeCounter).map(type => ({
      name: type,
      value: typeCounter[type]
    }));
    
    // Prepare timeline data
    let timelineData = [];
    if (filtered.length > 0) {
      const timeGroups = {};
      
      // Group by hour, day, or week depending on the time range
      filtered.forEach(attempt => {
        let key;
        const attemptDate = new Date(attempt.timestamp);
        if (selectedTimeRange === '24h') {
          // Group by hour
          key = attemptDate.toISOString().slice(0, 13);
        } else if (selectedTimeRange === '7d') {
          // Group by day
          key = attemptDate.toISOString().slice(0, 10);
        } else {
          // Group by week for 30d and all
          const weekNumber = Math.floor((now - attemptDate) / (7 * 24 * 60 * 60 * 1000));
          key = weekNumber === 0 ? 'This week' : `${weekNumber} week${weekNumber > 1 ? 's' : ''} ago`;
        }
        
        if (!timeGroups[key]) {
          timeGroups[key] = 0;
        }
        timeGroups[key]++;
      });
      
      // Convert to array for chart
      timelineData = Object.keys(timeGroups).map(key => ({
        time: key,
        attempts: timeGroups[key]
      }));
      
      // Sort by time
      timelineData.sort((a, b) => {
        if (selectedTimeRange === '24h' || selectedTimeRange === '7d') {
          return a.time.localeCompare(b.time);
        }
        return 0; // For week grouping, the order is already correct
      });
    }
    
    setStatsData({
      totalAttempts: filtered.length,
      activeAttempts,
      mitigatedAttempts,
      averageSeverity: avgSeverity,
      phishingTypes: phishingTypesData,
      timelineData
    });
  };

  // Form input handlers
  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData({
      ...formData,
      [name]: value
    });
    
    // Clear error for this field when user types
    if (formErrors[name]) {
      setFormErrors({
        ...formErrors,
        [name]: ''
      });
    }
  };

  const validateForm = () => {
    let isValid = true;
    const errors = {
      sourceEmail: '',
      targetDomain: '',
      maliciousURL: ''
    };
    
    // Validate email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!formData.sourceEmail) {
      errors.sourceEmail = 'Source email is required';
      isValid = false;
    } else if (!emailRegex.test(formData.sourceEmail)) {
      errors.sourceEmail = 'Invalid email format';
      isValid = false;
    }
    
    // Validate target domain
    if (!formData.targetDomain) {
      errors.targetDomain = 'Target domain is required';
      isValid = false;
    }
    
    // Validate URL if provided
    if (formData.maliciousURL) {
      try {
        new URL(formData.maliciousURL);
      } catch (e) {
        errors.maliciousURL = 'Invalid URL format';
        isValid = false;
      }
    }
    
    setFormErrors(errors);
    return isValid;
  };

  // Submit new phishing attempt
  // Submit new phishing attempt - Simplified version
const handleSubmit = async (e) => {
  e.preventDefault();
  
  if (!validateForm()) {
    return;
  }
  
  if (!contract) {
    toast.error('Not connected to blockchain');
    return;
  }
  
  try {
    setFormLoading(true);
    toast.info('Submitting phishing attempt...');

    // Generate a simple hash if not provided
    const contentHash = formData.contentHash || `hash-${Date.now()}`;

    // Convert phishing type to integer for the smart contract
    const phishingTypeMap = {
      'credential_theft': 0,
      'financial_scam': 1,
      'data_theft': 2,
      'malware_distribution': 3,
      'social_engineering': 4,
      'other': 5
    };
    
    // API endpoint submission for better UX
    const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:3001'}/api/report-phishing`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        sourceEmail: formData.sourceEmail,
        targetDomain: formData.targetDomain,
        phishingType: formData.phishingType,
        severity: parseInt(formData.severity),
        contentHash: contentHash
      })
    });
    
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || `API responded with status ${response.status}`);
    }
    
    const result = await response.json();
    toast.success('Phishing attempt reported successfully!');
    
    // Reset form
    setFormData({
      sourceEmail: '',
      targetDomain: '',
      phishingType: 'credential_theft',
      severity: 3,
      contentHash: ''
    });
    
    // Reload data
    loadPhishingAttempts();
    
  } catch (error) {
    console.error('Failed to submit phishing attempt:', error);
    toast.error(error.message || 'Failed to submit phishing attempt');
    
    // Fallback to direct contract interaction
    try {
      const phishingTypeValue = {
        'credential_theft': 0,
        'financial_scam': 1,
        'data_theft': 2,
        'malware_distribution': 3, 
        'social_engineering': 4,
        'other': 5
      }[formData.phishingType] || 5;
      
      const contentHash = formData.contentHash || `hash-${Date.now()}`;
      
      const tx = await contract.logPhishingAttempt(
        formData.sourceEmail,
        formData.targetDomain,
        phishingTypeValue,
        parseInt(formData.severity),
        contentHash
      );
      
      toast.info('Transaction submitted, waiting for confirmation...');
      await tx.wait();
      
      toast.success('Phishing attempt reported successfully!');
      
      // Reset form
      setFormData({
        sourceEmail: '',
        targetDomain: '',
        phishingType: 'credential_theft',
        severity: 3,
        contentHash: ''
      });
      
      // Reload data
      loadPhishingAttempts();
      
    } catch (error) {
      console.error('Direct contract interaction also failed:', error);
      toast.error('Transaction failed: ' + (error.message || 'Unknown error'));
    }
  } finally {
    setFormLoading(false);
  }
};

  // Update phishing attempt status
  const updateAttemptStatus = async (id, newStatus) => {
    if (!contract) return;

    try {
      setLoading(true);
      toast.info('Updating status...');

      const tx = await contract.updateAttemptStatus(id, newStatus);
      await tx.wait();

      toast.success('Status updated successfully');
      await loadPhishingAttempts();
    } catch (error) {
      console.error('Failed to update status:', error);
      toast.error('Error updating status');
    } finally {
      setLoading(false);
    }
  };

  // Status badge styling
  const getStatusBadgeClass = (status) => {
    switch (status) {
      case 'ACTIVE':
        return 'bg-red-500';
      case 'MITIGATED':
        return 'bg-green-500';
      case 'INVESTIGATING':
        return 'bg-yellow-500';
      case 'CLOSED':
        return 'bg-gray-500';
      default:
        return 'bg-blue-500';
    }
  };

  // Severity rating color and label
  const getSeverityDisplay = (level) => {
    const colors = {
      1: 'bg-blue-500',
      2: 'bg-blue-600',
      3: 'bg-yellow-500',
      4: 'bg-orange-500',
      5: 'bg-red-500'
    };
    
    const labels = {
      1: 'Very Low',
      2: 'Low',
      3: 'Medium',
      4: 'High',
      5: 'Critical'
    };
    
    return {
      color: colors[level] || 'bg-gray-500',
      label: labels[level] || 'Unknown'
    };
  };

  const formatTimestamp = (timestamp) => {
    return new Date(timestamp).toLocaleString();
  };

  // Truncate long text
  const truncateText = (text, maxLength = 30) => {
    if (!text) return '';
    return text.length > maxLength ? text.substring(0, maxLength) + '...' : text;
  };

  // Pie chart colors
  const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#ff6b6b'];

  // Loading indicator
  if (loading && attempts.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-4 text-blue-600" />
          <p className="text-gray-600">Loading phishing data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto p-6">
      <div className="bg-white rounded-lg shadow-lg p-6 mb-8">
        {/* Header section */}
        <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4">
          <div className="flex items-center gap-2">
            <Shield className="w-8 h-8 text-red-600" />
            <div>
              <h1 className="text-2xl font-bold text-gray-800">Phishing Attack Monitor</h1>
              <p className="text-gray-500 text-sm">
                Blockchain-powered phishing threat intelligence
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <div className={`h-2 w-2 rounded-full ${
                connectionStatus === 'connected' ? 'bg-green-500' : 'bg-red-500'
              }`} />
              <span className="text-sm text-gray-600">
                {connectionStatus === 'connected' ? 'Connected to blockchain' : 'Not connected'}
              </span>
            </div>
            
            <div className="flex gap-2">
              <select 
                value={selectedTimeRange}
                onChange={(e) => setSelectedTimeRange(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-md text-sm"
              >
                <option value="24h">Last 24 Hours</option>
                <option value="7d">Last 7 Days</option>
                <option value="30d">Last 30 Days</option>
                <option value="all">All Time</option>
              </select>
              
              <button 
                onClick={loadPhishingAttempts}
                disabled={loading}
                className="p-2 bg-blue-50 text-blue-600 rounded-md hover:bg-blue-100 disabled:opacity-50"
                title="Refresh data"
              >
                <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              </button>
            </div>
          </div>
        </div>
        
        {/* Stats cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="bg-blue-50 p-4 rounded-lg">
            <div className="flex items-center justify-between">
              <h3 className="text-blue-800 font-medium">Total Attempts</h3>
              <Mail className="w-5 h-5 text-blue-600" />
            </div>
            <p className="text-3xl font-bold text-blue-900 mt-2">{statsData.totalAttempts}</p>
          </div>
          
          <div className="bg-red-50 p-4 rounded-lg">
            <div className="flex items-center justify-between">
              <h3 className="text-red-800 font-medium">Active Threats</h3>
              <AlertOctagon className="w-5 h-5 text-red-600" />
            </div>
            <p className="text-3xl font-bold text-red-900 mt-2">{statsData.activeAttempts}</p>
          </div>
          
          <div className="bg-green-50 p-4 rounded-lg">
            <div className="flex items-center justify-between">
              <h3 className="text-green-800 font-medium">Mitigated</h3>
              <Check className="w-5 h-5 text-green-600" />
            </div>
            <p className="text-3xl font-bold text-green-900 mt-2">{statsData.mitigatedAttempts}</p>
          </div>
          
          <div className="bg-yellow-50 p-4 rounded-lg">
            <div className="flex items-center justify-between">
              <h3 className="text-yellow-800 font-medium">Avg. Severity</h3>
              <AlertTriangle className="w-5 h-5 text-yellow-600" />
            </div>
            <p className="text-3xl font-bold text-yellow-900 mt-2">{statsData.averageSeverity}</p>
          </div>
        </div>

        {/* Form for submitting new phishing attempts */}
        <div className="bg-white border border-gray-200 rounded-lg p-6 mb-8">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-800">Report New Phishing Attempt</h3>
            <button 
              type="button"
              className="px-3 py-1 text-sm bg-blue-100 text-blue-700 rounded-md hover:bg-blue-200"
              onClick={() => {
                // Generate sample random hash for content hash field
                const randomHash = [...Array(40)].map(() => Math.floor(Math.random() * 16).toString(16)).join('');
                setFormData({
                  ...formData,
                  contentHash: `0x${randomHash}`
                });
              }}
            >
              Generate Hash
            </button>
          </div>
          
          <form onSubmit={handleSubmit}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Source Email*
                </label>
                <input
                  type="email"
                  name="sourceEmail"
                  value={formData.sourceEmail}
                  onChange={handleInputChange}
                  className={`w-full p-2 border ${formErrors.sourceEmail ? 'border-red-500' : 'border-gray-300'} rounded-md`}
                  placeholder="phishing@malicious-domain.com"
                  required
                />
                {formErrors.sourceEmail && (
                  <p className="mt-1 text-sm text-red-600">{formErrors.sourceEmail}</p>
                )}
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Target Domain*
                </label>
                <input
                  type="text"
                  name="targetDomain"
                  value={formData.targetDomain}
                  onChange={handleInputChange}
                  className={`w-full p-2 border ${formErrors.targetDomain ? 'border-red-500' : 'border-gray-300'} rounded-md`}
                  placeholder="company.com"
                  required
                />
                {formErrors.targetDomain && (
                  <p className="mt-1 text-sm text-red-600">{formErrors.targetDomain}</p>
                )}
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Phishing Type*
                </label>
                <select
                  name="phishingType"
                  value={formData.phishingType}
                  onChange={handleInputChange}
                  className="w-full p-2 border border-gray-300 rounded-md"
                  required
                >
                  <option value="credential_theft">Credential Theft</option>
                  <option value="financial_scam">Financial Scam</option>
                  <option value="data_theft">Data Theft</option>
                  <option value="malware_distribution">Malware Distribution</option>
                  <option value="social_engineering">Social Engineering</option>
                  <option value="other">Other</option>
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Severity Level* ({formData.severity})
                </label>
                <input
                  type="range"
                  name="severity"
                  min="1"
                  max="5"
                  value={formData.severity}
                  onChange={handleInputChange}
                  className="w-full"
                  required
                />
                <div className="flex justify-between text-xs text-gray-500">
                  <span>Low</span>
                  <span>High</span>
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Email Subject
                </label>
                <input
                  type="text"
                  name="emailSubject"
                  value={formData.emailSubject}
                  onChange={handleInputChange}
                  className="w-full p-2 border border-gray-300 rounded-md"
                  placeholder="Urgent: Account Verification Required"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Malicious URL
                </label>
                <input
                  type="text"
                  name="maliciousURL"
                  value={formData.maliciousURL}
                  onChange={handleInputChange}
                  className={`w-full p-2 border ${formErrors.maliciousURL ? 'border-red-500' : 'border-gray-300'} rounded-md`}
                  placeholder="https://malicious-site.com"
                />
                {formErrors.maliciousURL && (
                  <p className="mt-1 text-sm text-red-600">{formErrors.maliciousURL}</p>
                )}
              </div>
              
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Content Hash (optional)
                </label>
                <input
                  type="text"
                  name="contentHash"
                  value={formData.contentHash}
                  onChange={handleInputChange}
                  className="w-full p-2 border border-gray-300 rounded-md"
                  placeholder="0x1a2b3c4d..."
                />
              </div>
              
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Additional Information
                </label>
                <textarea
                  name="additionalInfo"
                  value={formData.additionalInfo}
                  onChange={handleInputChange}
                  className="w-full p-2 border border-gray-300 rounded-md"
                  rows="3"
                  placeholder="Add any additional context about this phishing attempt..."
                ></textarea>
              </div>
            </div>
            
            <div className="flex justify-end">
              <button
                type="submit"
                disabled={formLoading || connectionStatus !== 'connected'}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
              >
                {formLoading && <RefreshCw className="w-4 h-4 mr-2 animate-spin" />}
                Submit Report
              </button>
            </div>
          </form>
        </div>
        
        {/* Charts section */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
          {/* Timeline chart */}
          <div className="bg-gray-50 p-4 rounded-lg shadow">
            <h3 className="text-lg font-semibold mb-4 text-gray-800">Phishing Attempts Timeline</h3>
            <div className="h-64">
              {statsData.timelineData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={statsData.timelineData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis 
                      dataKey="time" 
                      tick={{ fontSize: 12 }}
                      angle={-45}
                      textAnchor="end"
                    />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="attempts" fill="#f87171" name="Phishing Attempts" />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-full">
                  <p className="text-gray-500">No data available for the selected time range</p>
                </div>
              )}
            </div>
          </div>
          
          {/* Phishing types distribution */}
          <div className="bg-gray-50 p-4 rounded-lg shadow">
            <h3 className="text-lg font-semibold mb-4 text-gray-800">Attack Types</h3>
            <div className="h-64">
              {statsData.phishingTypes.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={statsData.phishingTypes}
                      cx="50%"
                      cy="50%"
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="value"
                      nameKey="name"
                      label={({name, percent}) => `${name}: ${(percent * 100).toFixed(0)}%`}
                    >
                      {statsData.phishingTypes.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-full">
                  <p className="text-gray-500">No data available for the selected time range</p>
                </div>
              )}
            </div>
          </div>
        </div>
        
        {/* Recent attempts table */}
        <div className="bg-white rounded-lg shadow">
          <div className="flex items-center justify-between mb-4 px-6 pt-6">
            <h3 className="text-lg font-semibold text-gray-800">Recent Phishing Attempts</h3>
            <div className="relative">
              <Search className="h-4 w-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
              <input 
                type="text"
                placeholder="Search..."
                className="pl-9 pr-4 py-2 border border-gray-300 rounded-md"
              />
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">ID</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Source</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Target</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Type</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Severity</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {attempts.length > 0 ? (
                  attempts.slice(0, 10).map((attempt) => {
                    const severityInfo = getSeverityDisplay(attempt.severity);
                    return (
                      <tr key={attempt.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">#{attempt.id}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          <div className="flex items-center">
                            <Mail className="w-4 h-4 text-red-500 mr-2" />
                            <span title={attempt.sourceEmail}>{truncateText(attempt.sourceEmail, 20)}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{attempt.targetDomain}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {attempt.phishingType.replace(/_/g, ' ').toLowerCase()}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${severityInfo.color} text-white`}>
                            {severityInfo.label}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {new Date(attempt.timestamp).toLocaleDateString()}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatusBadgeClass(attempt.status)} text-white`}>
                            {attempt.status}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {attempt.status === 'ACTIVE' && (
                            <button 
                              onClick={() => updateAttemptStatus(attempt.id, 1)} 
                              className="text-green-600 hover:text-green-900 mr-2"
                              disabled={loading}
                            >
                              Mitigate
                            </button>
                          )}
                          {attempt.status !== 'CLOSED' && (
                            <button 
                              onClick={() => updateAttemptStatus(attempt.id, 3)}
                              className="text-gray-600 hover:text-gray-900"
                              disabled={loading}
                            >
                              Close
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan="8" className="px-6 py-4 text-center text-sm text-gray-500">
                      No phishing attempts found. Be the first to report one!
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          {attempts.length > 10 && (
            <div className="py-3 px-6 bg-gray-50 border-t border-gray-200 text-right">
              <span className="text-sm text-gray-500">
                Showing 10 of {attempts.length} attempts
              </span>
            </div>
          )}
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

export default PhishingMonitor;