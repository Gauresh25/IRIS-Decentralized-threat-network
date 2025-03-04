import React, { useState } from 'react';
import { 
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  BarChart, Bar, PieChart, Pie, Cell
} from 'recharts';
import { Shield, AlertTriangle, Mail, Activity, Network } from 'lucide-react';

// Dummy data for DDoS attacks
const ddosData = [
  { timestamp: '2025-02-10', requests: 15000 },
  { timestamp: '2025-02-11', requests: 18000 },
  { timestamp: '2025-02-12', requests: 25000 },
  { timestamp: '2025-02-13', requests: 42000 },
  { timestamp: '2025-02-14', requests: 32000 },
  { timestamp: '2025-02-15', requests: 28000 },
  { timestamp: '2025-02-16', requests: 22000 },
];

// Dummy data for phishing attempts
const phishingData = [
  { category: 'Credential Theft', value: 45 },
  { category: 'Financial Scam', value: 30 },
  { category: 'Data Theft', value: 15 },
  { category: 'Malware Distribution', value: 10 },
];

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042'];

const SecurityDashboard = () => {
  const [selectedTab, setSelectedTab] = useState('overview');

  const threatIncidents = [
    {
      type: 'DDoS',
      source: '192.168.1.100',
      timestamp: '2025-02-18 08:45:23',
      severity: 'High',
      details: 'SYN flood attack detected, peak traffic 40Gbps',
      status: 'Active'
    },
    {
      type: 'DDoS',
      source: '10.0.0.55',
      timestamp: '2025-02-18 09:12:15',
      severity: 'Medium',
      details: 'UDP flood attack, affecting application server',
      status: 'Mitigated'
    },
    {
      type: 'Phishing',
      source: 'suspicious@malicious-domain.com',
      timestamp: '2025-02-18 07:30:45',
      severity: 'High',
      details: 'Mass phishing campaign targeting executive accounts',
      status: 'Active'
    },
    {
      type: 'Phishing',
      source: 'finance@fake-bank.com',
      timestamp: '2025-02-18 06:15:33',
      severity: 'Medium',
      details: 'Banking credential theft attempt',
      status: 'Blocked'
    }
  ];

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <Shield className="w-8 h-8 text-blue-600" />
            <h1 className="text-2xl font-bold text-gray-800">Security Threat Dashboard</h1>
          </div>
          <div className="flex items-center gap-2">
            <span className="flex items-center gap-1">
              <Activity className="w-4 h-4 text-green-500" />
              <span className="text-sm text-gray-600">System Status: Operational</span>
            </span>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex gap-4 mb-6">
          <button
            onClick={() => setSelectedTab('overview')}
            className={`px-4 py-2 rounded-lg ${
              selectedTab === 'overview' 
                ? 'bg-blue-600 text-white' 
                : 'bg-white text-gray-600 hover:bg-gray-50'
            }`}
          >
            Overview
          </button>
          <button
            onClick={() => setSelectedTab('ddos')}
            className={`px-4 py-2 rounded-lg ${
              selectedTab === 'ddos' 
                ? 'bg-blue-600 text-white' 
                : 'bg-white text-gray-600 hover:bg-gray-50'
            }`}
          >
            DDoS Attacks
          </button>
          <button
            onClick={() => setSelectedTab('phishing')}
            className={`px-4 py-2 rounded-lg ${
              selectedTab === 'phishing' 
                ? 'bg-blue-600 text-white' 
                : 'bg-white text-gray-600 hover:bg-gray-50'
            }`}
          >
            Phishing Attempts
          </button>
        </div>

        {/* Main Content */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Metrics Overview */}
          <div className="bg-white p-6 rounded-lg shadow">
            <h2 className="text-lg font-semibold mb-4">Traffic Analysis</h2>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={ddosData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="timestamp" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Line 
                  type="monotone" 
                  dataKey="requests" 
                  stroke="#2563eb" 
                  name="Requests/min"
                />
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* Phishing Distribution */}
          <div className="bg-white p-6 rounded-lg shadow">
            <h2 className="text-lg font-semibold mb-4">Phishing Attack Types</h2>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={phishingData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
                  fill="#8884d8"
                  paddingAngle={5}
                  dataKey="value"
                  label
                >
                  {phishingData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>

          {/* Recent Threats */}
          <div className="bg-white p-6 rounded-lg shadow md:col-span-2">
            <h2 className="text-lg font-semibold mb-4">Recent Threats</h2>
            <div className="overflow-x-auto">
              <table className="min-w-full">
                <thead>
                  <tr className="bg-gray-50">
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Type</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Source</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Timestamp</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Severity</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Details</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {threatIncidents.map((threat, index) => (
                    <tr key={index}>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          {threat.type === 'DDoS' ? (
                            <Network className="w-4 h-4 text-red-500 mr-2" />
                          ) : (
                            <Mail className="w-4 h-4 text-yellow-500 mr-2" />
                          )}
                          {threat.type}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{threat.source}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{threat.timestamp}</td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                          threat.severity === 'High' 
                            ? 'bg-red-100 text-red-800' 
                            : 'bg-yellow-100 text-yellow-800'
                        }`}>
                          {threat.severity}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-500">{threat.details}</td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                          threat.status === 'Active'
                            ? 'bg-red-100 text-red-800'
                            : threat.status === 'Mitigated'
                            ? 'bg-green-100 text-green-800'
                            : 'bg-gray-100 text-gray-800'
                        }`}>
                          {threat.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SecurityDashboard;