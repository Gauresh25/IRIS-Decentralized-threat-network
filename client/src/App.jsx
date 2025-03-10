import React from 'react';
import { BrowserRouter as Router, Routes, Route, Link } from 'react-router-dom';
import ThreatMonitor from './components/ThreatMonitor';
import SecurityDashboard from './components/SecurityDashboard';
import { Shield, AlertTriangle, BarChart } from 'lucide-react';

// Layout component to maintain consistent structure across routes
const Layout = ({ children }) => {
  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex">
              <div className="flex-shrink-0 flex items-center">
                <Shield className="h-8 w-8 text-blue-600" />
                <span className="ml-2 text-xl font-bold text-gray-900">
                  Security Center
                </span>
              </div>
              <div className="ml-6 flex space-x-8">
                <Link
                  to="/"
                  className="inline-flex items-center px-1 pt-1 text-gray-900 hover:text-blue-600"
                >
                  <BarChart className="h-5 w-5 mr-1" />
                  Dashboard
                </Link>
                <Link
                  to="/monitor"
                  className="inline-flex items-center px-1 pt-1 text-gray-900 hover:text-blue-600"
                >
                  <AlertTriangle className="h-5 w-5 mr-1" />
                  Threat Monitor
                </Link>
              </div>
            </div>
          </div>
        </div>
      </nav>
      <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        {children}
      </main>
    </div>
  );
};

function App() {
  return (
    <Router>
      <Layout>
        <Routes>
          {/* Dashboard as the home page */}
          <Route 
            path="/" 
            element={<SecurityDashboard />} 
          />
          
          {/* Threat Monitor route */}
          <Route 
            path="/monitor" 
            element={<ThreatMonitor />} 
          />

          {/* Add more routes as needed */}
        </Routes>
      </Layout>
    </Router>
  );
}

export default App;