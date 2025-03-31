import React, { useState, useEffect } from 'react';
import { ethers } from 'ethers';
import { 
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  BarChart, Bar, PieChart, Pie, Cell
} from 'recharts';
import { 
  Shield, AlertTriangle, Activity, Wifi, RefreshCw, Check, 
  Clock, HardDrive, Zap
} from 'lucide-react';
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

// ABI for the DOS Attack Logger Contract
const DosAttackLogger = {
  abi: [
    {
      "constant": true,
      "inputs": [],
      "name": "attackCount",
      "outputs": [{"name": "", "type": "uint256"}],
      "payable": false,
      "stateMutability": "view",
      "type": "function"
    },
    {
      "constant": true,
      "inputs": [{"name": "", "type": "uint256"}],
      "name": "attacks",
      "outputs": [
        {"name": "id", "type": "uint256"},
        {"name": "sourceIP", "type": "string"},
        {"name": "targetService", "type": "string"},
        {"name": "timestamp", "type": "uint256"},
        {"name": "attackType", "type": "uint8"},
        {"name": "trafficVolume", "type": "uint256"},
        {"name": "duration", "type": "uint256"},
        {"name": "additionalInfo", "type": "string"},
        {"name": "status", "type": "uint8"}
      ],
      "payable": false,
      "stateMutability": "view",
      "type": "function"
    },
    {
      "constant": false,
      "inputs": [
        {"name": "_sourceIP", "type": "string"},
        {"name": "_targetService", "type": "string"},
        {"name": "_timestamp", "type": "uint256"},
        {"name": "_attackType", "type": "uint256"},
        {"name": "_trafficVolume", "type": "uint256"},
        {"name": "_duration", "type": "uint256"},
        {"name": "_additionalInfo", "type": "string"}
      ],
      "name": "logAttack",
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
      "name": "updateAttackStatus",
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
      "name": "getAttack",
      "outputs": [
        {"name": "id", "type": "uint256"},
        {"name": "sourceIP", "type": "string"},
        {"name": "targetService", "type": "string"},
        {"name": "timestamp", "type": "uint256"},
        {"name": "attackType", "type": "uint256"},
        {"name": "trafficVolume", "type": "uint256"},
        {"name": "duration", "type": "uint256"},
        {"name": "additionalInfo", "type": "string"},
        {"name": "status", "type": "uint256"}
      ],
      "payable": false,
      "stateMutability": "view",
      "type": "function"
    }
  ]
};

const DoSMonitor = () => {
  // State management
  const [attacks, setAttacks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [contract, setContract] = useState(null);
  const [connectionStatus, setConnectionStatus] = useState('disconnected');
  const [account, setAccount] = useState(null);
  const [statsData, setStatsData] = useState({
    totalAttacks: 0,
    activeAttacks: 0,
    mitigatedAttacks: 0,
    avgTrafficVolume: 0,
    attackTypes: [],
    timelineData: []
  });
  const [selectedTimeRange, setSelectedTimeRange] = useState('24h');

  // Expose a debug function to the window object
  window.debugContract = async () => {
    try {
      if (!window.ethereum) return console.log('No ethereum provider found');
      
      console.log('Contract address to check:', '0xe609FDf051E7C3113d6b3246C604971bB384f7D7');
      
      const provider = new ethers.BrowserProvider(window.ethereum);
      console.log('Provider created');
      
      const code = await provider.getCode('0xe609FDf051E7C3113d6b3246C604971bB384f7D7');
      console.log('Code at address:', code);
      
      if (code === '0x') {
        console.log('No contract at this address!');
        return;
      }
      
      const signer = await provider.getSigner();
      console.log('Signer obtained:', await signer.getAddress());
      
      const dosContract = new ethers.Contract(
        '0xe609FDf051E7C3113d6b3246C604971bB384f7D7',
        DosAttackLogger.abi,
        signer
      );
      console.log('Contract instance created');
      
      try {
        const count = await dosContract.attackCount();
        console.log('Attack count:', count.toString());
      } catch (error) {
        console.error('Error calling attackCount:', error);
      }
    } catch (error) {
      console.error('Debug error:', error);
    }
  };

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

  // Load attacks when contract is ready
  useEffect(() => {
    if (contract && account) {
      loadAttacks();
      
      // Set up auto-refresh every 30 seconds
      const interval = setInterval(() => {
        loadAttacks();
      }, 30000);
      
      return () => clearInterval(interval);
    }
  }, [contract, account]);

  // Process attack data for stats when attacks change
  useEffect(() => {
    if (attacks.length > 0) {
      processAttackStats();
    }
  }, [attacks, selectedTimeRange]);

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
        const contractAddress = '0x681C51aFCcb411d84f3F5634bf6d0380502eAFEE';
        
        const dosContract = new ethers.Contract(
          contractAddress,
          DosAttackLogger.abi,
          signer
        );
        
        // Check if connected properly
        try {
          // Add debugging to see contract address
          console.log('Attempting to connect to contract at:', contractAddress);
          
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
          const data = dosContract.interface.encodeFunctionData("attackCount");
          console.log('Encoded function data:', data);
          
          const rawResult = await provider.call({
            to: contractAddress,
            data: data
          });
          console.log('Raw call result:', rawResult);
          
          // Now try the regular method call
          const count = await dosContract.attackCount();
          console.log('Connected to DoS Attack Logger, attack count:', count.toString());
          setContract(dosContract);
          setConnectionStatus('connected');
        } catch (error) {
          console.error('Contract connection error:', error);
          toast.error('Failed to connect to the DoS Attack Logger contract');
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

  const loadAttacks = async () => {
    if (!contract) return;
    
    try {
      setLoading(true);
      
      const count = await contract.attackCount();
      const attacksData = [];
      
      for (let i = 1; i <= Number(count); i++) {
        try {
          const attack = await contract.getAttack(i);
          
          // Convert the returned data to a more usable format
          // Note: In ethers v6, BigInt is used instead of BigNumber
          attacksData.push({
            id: Number(attack[0]),
            sourceIP: attack[1],
            targetService: attack[2],
            timestamp: new Date(Number(attack[3]) * 1000),
            attackType: ['SYN Flood', 'UDP Flood', 'HTTP Flood', 'ICMP Flood', 'Slowloris', 'Other'][Number(attack[4])],
            trafficVolume: Number(attack[5]),
            duration: Number(attack[6]),
            additionalInfo: attack[7],
            status: ['Active', 'Mitigated', 'Investigating', 'Closed'][Number(attack[8])]
          });
        } catch (error) {
          console.error(`Error loading attack ${i}:`, error);
        }
      }
      
      // Sort by timestamp (newest first)
      attacksData.sort((a, b) => b.timestamp - a.timestamp);
      setAttacks(attacksData);
      
    } catch (error) {
      console.error('Failed to load attacks:', error);
      toast.error('Error loading attack data');
    } finally {
      setLoading(false);
    }
  };

  const processAttackStats = () => {
    // Filter attacks based on selected time range
    const now = new Date();
    const filtered = attacks.filter(attack => {
      if (selectedTimeRange === '24h') {
        return (now - attack.timestamp) < 24 * 60 * 60 * 1000;
      } else if (selectedTimeRange === '7d') {
        return (now - attack.timestamp) < 7 * 24 * 60 * 60 * 1000;
      } else if (selectedTimeRange === '30d') {
        return (now - attack.timestamp) < 30 * 24 * 60 * 60 * 1000;
      }
      return true; // 'all' case
    });
    
    // Calculate stats
    const activeAttacks = filtered.filter(a => a.status === 'Active').length;
    const mitigatedAttacks = filtered.filter(a => a.status === 'Mitigated').length;
    
    // Calculate average traffic volume
    const totalVolume = filtered.reduce((sum, attack) => sum + attack.trafficVolume, 0);
    const avgVolume = filtered.length > 0 ? Math.round(totalVolume / filtered.length) : 0;
    
    // Count attack types
    const attackTypeCounter = {};
    filtered.forEach(attack => {
      attackTypeCounter[attack.attackType] = (attackTypeCounter[attack.attackType] || 0) + 1;
    });
    
    // Prepare data for pie chart
    const attackTypesData = Object.keys(attackTypeCounter).map(type => ({
      name: type,
      value: attackTypeCounter[type]
    }));
    
    // Prepare timeline data
    let timelineData = [];
    if (filtered.length > 0) {
      const timeGroups = {};
      
      // Group by hour, day, or week depending on the time range
      filtered.forEach(attack => {
        let key;
        if (selectedTimeRange === '24h') {
          // Group by hour
          key = attack.timestamp.toISOString().slice(0, 13);
        } else if (selectedTimeRange === '7d') {
          // Group by day
          key = attack.timestamp.toISOString().slice(0, 10);
        } else {
          // Group by week for 30d and all
          const weekNumber = Math.floor((now - attack.timestamp) / (7 * 24 * 60 * 60 * 1000));
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
        attacks: timeGroups[key]
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
      totalAttacks: filtered.length,
      activeAttacks,
      mitigatedAttacks,
      avgTrafficVolume: avgVolume,
      attackTypes: attackTypesData,
      timelineData
    });
  };

  // Update attack status
  const updateAttackStatus = async (id, newStatus) => {
    if (!contract) return;

    try {
      setLoading(true);
      toast.info('Updating attack status...');

      const tx = await contract.updateAttackStatus(id, newStatus);
      await tx.wait(); // Wait for transaction to be mined

      toast.success('Attack status updated successfully');
      await loadAttacks(); // Reload attacks to reflect changes
    } catch (error) {
      console.error('Failed to update attack status:', error);
      toast.error('Error updating attack status');
    } finally {
      setLoading(false);
    }
  };

  // Status badge styling
  const getStatusBadgeClass = (status) => {
    switch (status) {
      case 'Active':
        return 'bg-red-500';
      case 'Mitigated':
        return 'bg-green-500';
      case 'Investigating':
        return 'bg-yellow-500';
      case 'Closed':
        return 'bg-gray-500';
      default:
        return 'bg-blue-500';
    }
  };

  const formatTimestamp = (timestamp) => {
    return new Date(timestamp).toLocaleString();
  };

  // Pie chart colors
  const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#ff6b6b'];

  // Loading indicator
  if (loading && attacks.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-4 text-blue-600" />
          <p className="text-gray-600">Loading DoS attack data...</p>
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
            <Shield className="w-8 h-8 text-blue-600" />
            <div>
              <h1 className="text-2xl font-bold text-gray-800">DoS Attack Monitor</h1>
              <p className="text-gray-500 text-sm">
                Blockchain-powered attack visualization
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
                onClick={loadAttacks}
                className="p-2 bg-blue-50 text-blue-600 rounded-md hover:bg-blue-100"
                title="Refresh data"
              >
                <RefreshCw className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
        
        {/* Stats cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="bg-blue-50 p-4 rounded-lg">
            <div className="flex items-center justify-between">
              <h3 className="text-blue-800 font-medium">Total Attacks</h3>
              <AlertTriangle className="w-5 h-5 text-blue-600" />
            </div>
            <p className="text-3xl font-bold text-blue-900 mt-2">{statsData.totalAttacks}</p>
          </div>
          
          <div className="bg-red-50 p-4 rounded-lg">
            <div className="flex items-center justify-between">
              <h3 className="text-red-800 font-medium">Active Threats</h3>
              <Activity className="w-5 h-5 text-red-600" />
            </div>
            <p className="text-3xl font-bold text-red-900 mt-2">{statsData.activeAttacks}</p>
          </div>
          
          <div className="bg-green-50 p-4 rounded-lg">
            <div className="flex items-center justify-between">
              <h3 className="text-green-800 font-medium">Mitigated</h3>
              <Check className="w-5 h-5 text-green-600" />
            </div>
            <p className="text-3xl font-bold text-green-900 mt-2">{statsData.mitigatedAttacks}</p>
          </div>
          
          <div className="bg-yellow-50 p-4 rounded-lg">
            <div className="flex items-center justify-between">
              <h3 className="text-yellow-800 font-medium">Avg. Volume</h3>
              <Zap className="w-5 h-5 text-yellow-600" />
            </div>
            <p className="text-3xl font-bold text-yellow-900 mt-2">{statsData.avgTrafficVolume} Mbps</p>
          </div>
        </div>
        
        {/* Charts section */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
          {/* Attack timeline chart */}
          <div className="bg-gray-50 p-4 rounded-lg">
            <h3 className="text-lg font-semibold mb-4 text-gray-800">Attack Timeline</h3>
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
                    <Bar dataKey="attacks" fill="#3b82f6" name="Attacks" />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-full">
                  <p className="text-gray-500">No data available for the selected time range</p>
                </div>
              )}
            </div>
          </div>
          
          {/* Attack types distribution */}
          <div className="bg-gray-50 p-4 rounded-lg">
            <h3 className="text-lg font-semibold mb-4 text-gray-800">Attack Types</h3>
            <div className="h-64">
              {statsData.attackTypes.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={statsData.attackTypes}
                      cx="50%"
                      cy="50%"
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="value"
                      label={({name, percent}) => `${name}: ${(percent * 100).toFixed(0)}%`}
                    >
                      {statsData.attackTypes.map((entry, index) => (
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
        
        {/* Recent attacks table */}
        <div className="bg-white rounded-lg">
          <h3 className="text-lg font-semibold mb-4 text-gray-800">Recent Attacks</h3>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">ID</th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Source IP</th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Target</th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Type</th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Volume</th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Timestamp</th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {attacks.length > 0 ? (
                  attacks.slice(0, 10).map((attack) => (
                    <tr key={attack.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">#{attack.id}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{attack.sourceIP}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{attack.targetService}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{attack.attackType}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{attack.trafficVolume} Mbps</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{formatTimestamp(attack.timestamp)}</td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatusBadgeClass(attack.status)} text-white`}>
                          {attack.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {attack.status === 'Active' && (
                          <button 
                            onClick={() => updateAttackStatus(attack.id, 1)} // 1 = Mitigated
                            className="text-green-600 hover:text-green-900 mr-2"
                            disabled={loading}
                          >
                            Mitigate
                          </button>
                        )}
                        {attack.status !== 'Closed' && (
                          <button 
                            onClick={() => updateAttackStatus(attack.id, 3)} // 3 = Closed
                            className="text-gray-600 hover:text-gray-900"
                            disabled={loading}
                          >
                            Close
                          </button>
                        )}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="8" className="px-6 py-4 text-center text-sm text-gray-500">
                      No attacks found. Either no attacks have been logged or there's an issue connecting to the blockchain.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          {attacks.length > 10 && (
            <div className="py-3 px-6 bg-gray-50 border-t border-gray-200 text-right">
              <span className="text-sm text-gray-500">
                Showing 10 of {attacks.length} attacks
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

export default DoSMonitor;