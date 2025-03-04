import React, { useState, useEffect } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Activity } from 'lucide-react';

const RequestMonitor = () => {
  const [requests, setRequests] = useState([]);
  const [totalRequests, setTotalRequests] = useState(0);

  // Log each incoming request
  useEffect(() => {
    const logRequest = () => {
      const timestamp = new Date().toLocaleTimeString();
      
      setRequests(prevRequests => {
        const newRequests = [...prevRequests, {
          time: timestamp,
          count: 1
        }];
        // Keep last 50 requests for the chart
        return newRequests.slice(-50);
      });
      
      setTotalRequests(prev => prev + 1);
    };

    // Add event listener for page loads
    window.addEventListener('load', logRequest);
    
    // Log requests when component mounts
    logRequest();

    return () => {
      window.removeEventListener('load', logRequest);
    };
  }, []);

  return (
    <div className="p-4 bg-gray-100 min-h-screen">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center gap-2 mb-6">
          <Activity className="w-6 h-6 text-blue-600" />
          <h1 className="text-2xl font-bold">Request Monitor</h1>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          <div className="bg-white p-4 rounded-lg shadow">
            <h2 className="text-lg font-semibold mb-2">Total Requests</h2>
            <p className="text-3xl font-bold text-blue-600">{totalRequests}</p>
          </div>
          
          <div className="bg-white p-4 rounded-lg shadow">
            <h2 className="text-lg font-semibold mb-2">Last Request</h2>
            <p className="text-lg">
              {requests.length > 0 ? requests[requests.length - 1].time : 'No requests yet'}
            </p>
          </div>
        </div>

        <div className="bg-white p-4 rounded-lg shadow">
          <h2 className="text-lg font-semibold mb-4">Request Timeline</h2>
          <div className="h-96">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={requests}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis 
                  dataKey="time"
                  tick={{ fontSize: 12 }}
                  angle={-45}
                  textAnchor="end"
                />
                <YAxis />
                <Tooltip />
                <Line 
                  type="monotone" 
                  dataKey="count" 
                  stroke="#2563eb"
                  strokeWidth={2}
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
};

export default RequestMonitor;