import argparse
import os
import sys
import time
import logging
import threading
import queue
import json
import socket
import struct
import subprocess
from datetime import datetime
from collections import defaultdict, deque
import ipaddress
import requests
from tabulate import tabulate

try:
    from scapy.all import sniff, IP, TCP, UDP, ICMP, Raw
except ImportError:
    print("Scapy library not found. Installing...")
    subprocess.check_call([sys.executable, "-m", "pip", "install", "scapy"])
    from scapy.all import sniff, IP, TCP, UDP, ICMP, Raw

# Set up logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler("dos_detector.log"),
        logging.StreamHandler(sys.stdout)
    ]
)
logger = logging.getLogger("DoS-Detector")

class DoSDetector:
    def __init__(self, interface=None, threshold=1000, time_window=10, block_ips=False, api_url=None):
        """
        Initialize the DoS Detector
        
        Args:
            interface: Network interface to monitor (None for all interfaces)
            threshold: Number of packets from a single IP to trigger alert
            time_window: Time window in seconds to count packets
            block_ips: Whether to block IPs when DoS detected
            api_url: URL to report attacks to (if None, don't report)
        """
        self.interface = interface
        self.threshold = threshold
        self.time_window = time_window
        self.block_ips = block_ips
        self.api_url = api_url
        
        # Data structures for tracking traffic
        self.packet_counts = defaultdict(int)  # IP -> count
        self.packet_timestamps = defaultdict(list)  # IP -> list of timestamps
        self.syn_flood_tracking = defaultdict(int)  # IP -> count of SYN packets
        self.http_flood_tracking = defaultdict(int)  # IP -> count of HTTP requests
        self.icmp_flood_tracking = defaultdict(int)  # IP -> count of ICMP packets
        self.blocked_ips = set()  # Set of blocked IPs
        
        # Thread-safe queue for processing packets
        self.packet_queue = queue.Queue()
        
        # Flag to control the detector threads
        self.running = True
        
        # Alert history
        self.alert_history = deque(maxlen=100)  # Store last 100 alerts

        # Show initialization message
        logger.info("DoS Detector initialized")
        logger.info(f"Interface: {interface or 'All interfaces'}")
        logger.info(f"Threshold: {threshold} packets per {time_window} seconds")
        logger.info(f"IP Blocking: {'Enabled' if block_ips else 'Disabled'}")
        logger.info(f"API Reporting: {'Enabled at ' + api_url if api_url else 'Disabled'}")
        
    def start(self):
        """Start the DoS detector"""
        # Start packet processing thread
        self.processor_thread = threading.Thread(target=self._process_packets)
        self.processor_thread.daemon = True
        self.processor_thread.start()
        
        # Start maintenance thread (cleanup old data)
        self.maintenance_thread = threading.Thread(target=self._maintenance_task)
        self.maintenance_thread.daemon = True
        self.maintenance_thread.start()
        
        # Start the packet capture
        try:
            logger.info("Starting packet capture...")
            sniff(iface=self.interface, prn=self._packet_handler, store=0)
        except KeyboardInterrupt:
            logger.info("Stopping DoS detector...")
            self.stop()
        except Exception as e:
            logger.error(f"Error in packet capture: {e}")
            self.stop()
    
    def stop(self):
        """Stop the DoS detector"""
        self.running = False
        logger.info("DoS detector stopped")
        
        # Unblock any blocked IPs if needed
        if self.block_ips and self.blocked_ips:
            for ip in self.blocked_ips:
                self._unblock_ip(ip)
    
    def _packet_handler(self, packet):
        """Handle captured packets and place in queue for processing"""
        if not self.running:
            return
            
        try:
            # Check if packet has IP layer
            if IP in packet:
                # Put packet in queue for processing
                self.packet_queue.put(packet)
        except Exception as e:
            logger.error(f"Error handling packet: {e}")
    
    def _process_packets(self):
        """Process packets from the queue"""
        while self.running:
            try:
                # Get packet from queue with timeout
                packet = self.packet_queue.get(timeout=1)
                
                # Extract source IP
                src_ip = packet[IP].src
                
                # Skip processing for private IPs if desired
                if self._is_private_ip(src_ip) and not PROCESS_PRIVATE_IPS:
                    continue
                
                # Skip already blocked IPs
                if src_ip in self.blocked_ips:
                    continue
                
                # Update timestamps for this IP
                now = time.time()
                self.packet_timestamps[src_ip].append(now)
                
                # Increment packet count
                self.packet_counts[src_ip] += 1
                
                # Check for specific attack signatures
                self._check_attack_signatures(packet, src_ip)
                
                # Check if threshold exceeded
                self._check_thresholds(src_ip, now)
                
            except queue.Empty:
                # Queue timeout - just continue
                continue
            except Exception as e:
                logger.error(f"Error processing packet: {e}")
    
    def _check_attack_signatures(self, packet, src_ip):
        """Check for specific DoS attack signatures"""
        try:
            # Check for SYN flood (TCP with SYN flag but no ACK)
            if TCP in packet and packet[TCP].flags & 0x02 and not packet[TCP].flags & 0x10:
                self.syn_flood_tracking[src_ip] += 1
            
            # Check for HTTP flood (TCP port 80/443 with data)
            if TCP in packet and (packet[TCP].dport == 80 or packet[TCP].dport == 443) and Raw in packet:
                payload = str(packet[Raw].load)
                if "GET" in payload or "POST" in payload or "HTTP" in payload:
                    self.http_flood_tracking[src_ip] += 1
            
            # Check for ICMP flood
            if ICMP in packet:
                self.icmp_flood_tracking[src_ip] += 1
                
        except Exception as e:
            logger.error(f"Error checking attack signatures: {e}")
    
    def _check_thresholds(self, src_ip, current_time):
        """Check if any thresholds are exceeded and issue alert if needed"""
        try:
            # Clean old timestamps first
            self._clean_old_timestamps(src_ip, current_time)
            
            # Check timestamp count in window
            recent_packets = len(self.packet_timestamps[src_ip])
            
            # Check for general threshold
            if recent_packets >= self.threshold:
                attack_type = self._determine_attack_type(src_ip)
                self._trigger_alert(src_ip, recent_packets, attack_type)
                
            # Check specific attack type thresholds
            elif self.syn_flood_tracking[src_ip] >= self.threshold // 2:
                self._trigger_alert(src_ip, self.syn_flood_tracking[src_ip], "SYN flood")
                
            elif self.http_flood_tracking[src_ip] >= self.threshold // 3:
                self._trigger_alert(src_ip, self.http_flood_tracking[src_ip], "HTTP flood")
                
            elif self.icmp_flood_tracking[src_ip] >= self.threshold // 4:
                self._trigger_alert(src_ip, self.icmp_flood_tracking[src_ip], "ICMP flood")
                
        except Exception as e:
            logger.error(f"Error checking thresholds: {e}")
    
    def _determine_attack_type(self, src_ip):
        """Determine the most likely attack type based on packet statistics"""
        attack_types = {
            "SYN flood": self.syn_flood_tracking[src_ip],
            "HTTP flood": self.http_flood_tracking[src_ip],
            "ICMP flood": self.icmp_flood_tracking[src_ip]
        }
        
        # Find attack type with highest count
        max_type = max(attack_types.items(), key=lambda x: x[1])
        
        # If specific attack type has significant count, use it
        if max_type[1] > self.threshold // 5:
            return max_type[0]
        
        # Default to general DoS
        return "General DoS"
    
    def _trigger_alert(self, src_ip, packet_count, attack_type):
        """Trigger DoS alert for an IP"""
        # Check if we've already alerted on this IP
        for alert in self.alert_history:
            if alert['src_ip'] == src_ip and time.time() - alert['timestamp'] < self.time_window * 2:
                # Already alerted recently
                return
        
        logger.warning(f"⚠️ DoS ATTACK DETECTED: {attack_type} from {src_ip} ({packet_count} packets)")
        
        # Create alert record
        alert = {
            'timestamp': time.time(),
            'src_ip': src_ip,
            'packet_count': packet_count,
            'attack_type': attack_type
        }
        self.alert_history.append(alert)
        
        # Block IP if configured
        if self.block_ips:
            self._block_ip(src_ip)
        
        # Report to API if configured
        if self.api_url:
            self._report_to_api(src_ip, attack_type, packet_count)
        
        # Reset counters for this IP
        self.syn_flood_tracking[src_ip] = 0
        self.http_flood_tracking[src_ip] = 0
        self.icmp_flood_tracking[src_ip] = 0
    
    def _clean_old_timestamps(self, src_ip, current_time):
        """Clean up timestamps older than time window"""
        if src_ip in self.packet_timestamps:
            self.packet_timestamps[src_ip] = [
                ts for ts in self.packet_timestamps[src_ip]
                if current_time - ts <= self.time_window
            ]
    
    def _maintenance_task(self):
        """Background task to clean up old data"""
        while self.running:
            try:
                current_time = time.time()
                
                # Clean old packet counts and timestamps
                for ip in list(self.packet_timestamps.keys()):
                    self._clean_old_timestamps(ip, current_time)
                    
                    # If no recent packets, remove IP from tracking
                    if len(self.packet_timestamps[ip]) == 0:
                        del self.packet_timestamps[ip]
                        self.packet_counts.pop(ip, None)
                        self.syn_flood_tracking.pop(ip, None)
                        self.http_flood_tracking.pop(ip, None)
                        self.icmp_flood_tracking.pop(ip, None)
                
                # Sleep for a while
                time.sleep(5)
            except Exception as e:
                logger.error(f"Error in maintenance task: {e}")
                time.sleep(5)  # Still sleep on error
    
    def _block_ip(self, ip):
        """Block an IP using Windows Firewall"""
        if ip in self.blocked_ips:
            return  # Already blocked
            
        try:
            logger.info(f"Blocking IP: {ip}")
            
            # Windows Firewall command to block IP
            rule_name = f"DoS_Protection_Block_{ip.replace('.', '_')}"
            cmd = f'netsh advfirewall firewall add rule name="{rule_name}" dir=in action=block remoteip={ip}'
            
            process = subprocess.Popen(cmd, shell=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
            stdout, stderr = process.communicate()
            
            if process.returncode == 0:
                logger.info(f"Successfully blocked IP: {ip}")
                self.blocked_ips.add(ip)
            else:
                logger.error(f"Failed to block IP {ip}: {stderr.decode()}")
        except Exception as e:
            logger.error(f"Error blocking IP {ip}: {e}")
    
    def _unblock_ip(self, ip):
        """Unblock a previously blocked IP"""
        if ip not in self.blocked_ips:
            return  # Not blocked
            
        try:
            logger.info(f"Unblocking IP: {ip}")
            
            # Windows Firewall command to unblock IP
            rule_name = f"DoS_Protection_Block_{ip.replace('.', '_')}"
            cmd = f'netsh advfirewall firewall delete rule name="{rule_name}"'
            
            process = subprocess.Popen(cmd, shell=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
            stdout, stderr = process.communicate()
            
            if process.returncode == 0:
                logger.info(f"Successfully unblocked IP: {ip}")
                self.blocked_ips.remove(ip)
            else:
                logger.error(f"Failed to unblock IP {ip}: {stderr.decode()}")
        except Exception as e:
            logger.error(f"Error unblocking IP {ip}: {e}")
    
    def _report_to_api(self, src_ip, attack_type, packet_count):
        """Report attack to the API"""
        try:
            # Convert attack type to match API expectations
            api_attack_type = attack_type.lower().replace(' ', '')
            
            # Report to the API
            report_data = {
                "sourceIP": src_ip,
                "targetService": "windows-firewall",
                "attackType": api_attack_type,
                "trafficVolume": packet_count,
                "duration": self.time_window,
                "additionalInfo": f"Detected by Windows DoS Firewall at {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}"
            }
            
            logger.info(f"Reporting attack to API: {self.api_url}")
            
            response = requests.post(
                f"{self.api_url}/api/report-attack",
                json=report_data,
                timeout=5
            )
            
            if response.status_code == 201:
                logger.info(f"Successfully reported attack to API")
            else:
                logger.error(f"Failed to report to API: Status {response.status_code}, {response.text}")
        except Exception as e:
            logger.error(f"Error reporting to API: {e}")
    
    def show_statistics(self):
        """Show current statistics and alert history"""
        # Current traffic statistics
        current_traffic = []
        for ip, count in sorted(self.packet_counts.items(), key=lambda x: x[1], reverse=True)[:10]:
            current_traffic.append([
                ip,
                count,
                self.syn_flood_tracking.get(ip, 0),
                self.http_flood_tracking.get(ip, 0),
                self.icmp_flood_tracking.get(ip, 0),
                "BLOCKED" if ip in self.blocked_ips else ""
            ])
        
        print("\n==== Current Traffic (Top 10) ====")
        if current_traffic:
            print(tabulate(
                current_traffic,
                headers=["Source IP", "Packets", "SYN", "HTTP", "ICMP", "Status"],
                tablefmt="grid"
            ))
        else:
            print("No traffic detected yet.")
        
        # Recent alerts
        alerts = []
        for alert in sorted(self.alert_history, key=lambda x: x['timestamp'], reverse=True):
            alerts.append([
                datetime.fromtimestamp(alert['timestamp']).strftime('%Y-%m-%d %H:%M:%S'),
                alert['src_ip'],
                alert['attack_type'],
                alert['packet_count'],
                "BLOCKED" if alert['src_ip'] in self.blocked_ips else ""
            ])
        
        print("\n==== Recent Alerts ====")
        if alerts:
            print(tabulate(
                alerts,
                headers=["Timestamp", "Source IP", "Attack Type", "Packets", "Status"],
                tablefmt="grid"
            ))
        else:
            print("No alerts detected yet.")
    
    @staticmethod
    def _is_private_ip(ip):
        """Check if an IP address is private"""
        try:
            return ipaddress.ip_address(ip).is_private
        except:
            return False
            
            
class DashboardThread(threading.Thread):
    """Thread to display the dashboard"""
    def __init__(self, detector):
        super().__init__()
        self.detector = detector
        self.daemon = True  # Thread will exit when main thread exits
        
    def run(self):
        """Run the dashboard thread"""
        while True:
            try:
                # Clear console (Windows)
                os.system('cls' if os.name == 'nt' else 'clear')
                
                # Print header
                print("\n" + "=" * 70)
                print(f"WINDOWS DoS ATTACK DETECTOR AND FIREWALL")
                print(f"Time: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
                print("=" * 70)
                
                # Show detector statistics
                self.detector.show_statistics()
                
                # Sleep for a while
                time.sleep(5)
            except Exception as e:
                logger.error(f"Error in dashboard: {e}")
                time.sleep(5)  # Still sleep on error
                

def get_network_interfaces():
    """Get list of available network interfaces"""
    interfaces = []
    try:
        # Try using scapy's get_if_list
        from scapy.arch import get_if_list
        interfaces = get_if_list()
    except:
        # Fallback to socket approach for Windows
        try:
            # Just return possible interface names for Windows
            interfaces = ["Ethernet", "Wi-Fi", "Local Area Connection"]
        except:
            pass
    
    return interfaces


def check_admin():
    """Check if script is running with administrator privileges"""
    try:
        is_admin = os.getuid() == 0  # Unix-based systems
    except AttributeError:
        import ctypes
        is_admin = ctypes.windll.shell32.IsUserAnAdmin() != 0  # Windows
    
    return is_admin


# Main function
def main():
    # Parse command line arguments
    parser = argparse.ArgumentParser(description='Windows DoS Attack Detector and Firewall')
    
    parser.add_argument('-i', '--interface', help='Network interface to monitor')
    parser.add_argument('-t', '--threshold', type=int, default=1000, 
                      help='Packet threshold to trigger alert (default: 1000)')
    parser.add_argument('-w', '--window', type=int, default=10,
                      help='Time window in seconds (default: 10)')
    parser.add_argument('-b', '--block', action='store_true',
                      help='Block IPs when DoS detected')
    parser.add_argument('-a', '--api', help='API URL to report attacks')
    parser.add_argument('-p', '--private', action='store_true',
                      help='Process private IPs (default: ignore private IPs)')
    parser.add_argument('-l', '--list-interfaces', action='store_true',
                      help='List available network interfaces')
    
    args = parser.parse_args()
    
    # Set global setting for processing private IPs
    global PROCESS_PRIVATE_IPS
    PROCESS_PRIVATE_IPS = args.private
    
    # List network interfaces if requested
    if args.list_interfaces:
        interfaces = get_network_interfaces()
        print("Available network interfaces:")
        for i, interface in enumerate(interfaces):
            print(f"{i+1}. {interface}")
        return
    
    # Check for admin privileges if blocking IPs
    if args.block and not check_admin():
        print("Error: You must run this script as administrator to block IPs.")
        print("Please restart the script with administrator privileges.")
        return
    
    # Create and start the detector
    try:
        detector = DoSDetector(
            interface=args.interface,
            threshold=args.threshold,
            time_window=args.window,
            block_ips=args.block,
            api_url=args.api
        )
        
        # Start dashboard in a separate thread
        dashboard = DashboardThread(detector)
        dashboard.start()
        
        # Start detector
        detector.start()
    except KeyboardInterrupt:
        print("\nStopping DoS detector...")
    except Exception as e:
        logger.error(f"Error: {e}")


if __name__ == "__main__":
    # Set global variable for processing private IPs
    PROCESS_PRIVATE_IPS = False
    
    # Print banner
    print("\n" + "=" * 70)
    print(f"WINDOWS DoS ATTACK DETECTOR AND FIREWALL")
    print(f"Starting at: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print("=" * 70 + "\n")
    
    main()