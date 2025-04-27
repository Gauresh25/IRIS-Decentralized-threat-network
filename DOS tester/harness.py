import argparse
import subprocess
import os
import sys
import time
import threading
import random
from datetime import datetime

# ANSI colors for terminal output
GREEN = "\033[92m"
YELLOW = "\033[93m"
RED = "\033[91m"
BLUE = "\033[94m"
MAGENTA = "\033[95m"
CYAN = "\033[96m"
RESET = "\033[0m"
BOLD = "\033[1m"

class FirewallTestHarness:
    def __init__(self, firewall_script, attack_script, api_url=None, duration=30, 
                 intensity=200, verbose=False):
        """
        Initialize the test harness
        
        Args:
            firewall_script: Path to the windows DoS detector script
            attack_script: Path to the attack simulator script
            api_url: URL of the API to report to (optional)
            duration: Duration of each attack in seconds
            intensity: Intensity of attacks (packets per second)
            verbose: Whether to show detailed output
        """
        self.firewall_script = firewall_script
        self.attack_script = attack_script
        self.api_url = api_url
        self.duration = duration
        self.intensity = intensity
        self.verbose = verbose
        
        # Process handles
        self.firewall_process = None
        self.attack_process = None
        
        # Tracking for test results
        self.tests_run = 0
        self.tests_passed = 0
        self.tests_failed = 0
        
    def run_tests(self):
        """Run the full test suite"""
        self._print_header()
        
        try:
            # Start firewall in a separate process
            self._start_firewall()
            
            # Wait for firewall to initialize
            print(f"{BLUE}[*] Waiting for firewall to initialize...{RESET}")
            time.sleep(5)
            
            # Run individual attack tests
            self._run_test("SYN Flood Test", "syn")
            self._run_test("UDP Flood Test", "udp")
            self._run_test("HTTP Flood Test", "http")
            self._run_test("ICMP Flood Test", "icmp")
            
            # Optional: Run a multi-attack test
            self._run_test("Multi-Attack Test", "multi", count=2)
            
            # Print summary
            self._print_summary()
            
        except KeyboardInterrupt:
            print(f"\n{YELLOW}[!] Tests interrupted by user{RESET}")
        finally:
            # Clean up
            self._cleanup()
    
    def _start_firewall(self):
        """Start the firewall/DoS detector"""
        print(f"{BLUE}[*] Starting DoS detector...{RESET}")
        
        # Prepare command
        cmd = [sys.executable, self.firewall_script]
        
        # Add options if API is specified
        if self.api_url:
            cmd.extend(["--api", self.api_url])
            
        # Add --block option to enable IP blocking
        cmd.append("--block")
        
        # Start process
        try:
            if self.verbose:
                # Show output in console
                self.firewall_process = subprocess.Popen(cmd)
            else:
                # Redirect output to null
                self.firewall_process = subprocess.Popen(
                    cmd,
                    stdout=subprocess.DEVNULL if not self.verbose else None,
                    stderr=subprocess.DEVNULL if not self.verbose else None
                )
            
            print(f"{GREEN}[+] DoS detector started successfully{RESET}")
        except Exception as e:
            print(f"{RED}[!] Failed to start DoS detector: {e}{RESET}")
            sys.exit(1)
    
    def _run_attack(self, attack_type, count=None):
        """Run an attack simulation"""
        # Prepare command
        cmd = [sys.executable, self.attack_script, "127.0.0.1", 
               "--type", attack_type,
               "--duration", str(self.duration),
               "--intensity", str(self.intensity)]
        
        # Add count for multi-attack
        if attack_type == "multi" and count:
            cmd.extend(["--count", str(count)])
        
        # Start attack process
        try:
            if self.verbose:
                # Show output in console
                self.attack_process = subprocess.Popen(cmd)
            else:
                # Redirect output to null
                self.attack_process = subprocess.Popen(
                    cmd,
                    stdout=subprocess.DEVNULL if not self.verbose else None,
                    stderr=subprocess.DEVNULL if not self.verbose else None
                )
            
            # Wait for attack to complete
            self.attack_process.wait()
            
            # Reset attack process
            self.attack_process = None
            
            return True
        except Exception as e:
            print(f"{RED}[!] Attack execution failed: {e}{RESET}")
            return False
    
    def _run_test(self, test_name, attack_type, count=None):
        """Run a specific test"""
        self.tests_run += 1
        
        print(f"\n{BOLD}{BLUE}Running Test: {test_name}{RESET}")
        print(f"{BLUE}{'=' * (15 + len(test_name))}{RESET}")
        
        # Execute the attack
        print(f"{BLUE}[*] Executing {attack_type.upper()} attack...{RESET}")
        success = self._run_attack(attack_type, count)
        
        if success:
            # Wait a bit for firewall to process
            time.sleep(2)
            print(f"{GREEN}[+] Attack completed successfully{RESET}")
            self.tests_passed += 1
        else:
            print(f"{RED}[-] Attack execution failed{RESET}")
            self.tests_failed += 1
        
        # Add a random delay between tests (2-5 seconds)
        delay = random.uniform(2, 5)
        print(f"{BLUE}[*] Waiting {delay:.1f} seconds before next test...{RESET}")
        time.sleep(delay)
    
    def _cleanup(self):
        """Clean up processes"""
        # Stop attack process if running
        if self.attack_process and self.attack_process.poll() is None:
            print(f"{BLUE}[*] Stopping attack process...{RESET}")
            self.attack_process.terminate()
            self.attack_process.wait(timeout=5)
        
        # Stop firewall process if running
        if self.firewall_process and self.firewall_process.poll() is None:
            print(f"{BLUE}[*] Stopping DoS detector...{RESET}")
            self.firewall_process.terminate()
            self.firewall_process.wait(timeout=5)
    
    def _print_header(self):
        """Print test harness header"""
        print(f"\n{BOLD}{CYAN}======================================{RESET}")
        print(f"{BOLD}{CYAN}  DoS Firewall Testing Framework{RESET}")
        print(f"{BOLD}{CYAN}======================================{RESET}")
        print(f"{CYAN}Started at: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}{RESET}")
        print(f"{CYAN}Firewall script: {self.firewall_script}{RESET}")
        print(f"{CYAN}Attack script: {self.attack_script}{RESET}")
        print(f"{CYAN}API URL: {self.api_url or 'Not specified'}{RESET}")
        print(f"{CYAN}Attack duration: {self.duration} seconds{RESET}")
        print(f"{CYAN}Attack intensity: {self.intensity} packets/sec{RESET}")
        print(f"{BOLD}{CYAN}======================================{RESET}\n")
    
    def _print_summary(self):
        """Print test summary"""
        print(f"\n{BOLD}{CYAN}======================================{RESET}")
        print(f"{BOLD}{CYAN}  Test Summary{RESET}")
        print(f"{BOLD}{CYAN}======================================{RESET}")
        print(f"{CYAN}Total tests run: {self.tests_run}{RESET}")
        print(f"{GREEN}Tests passed: {self.tests_passed}{RESET}")
        print(f"{RED}Tests failed: {self.tests_failed}{RESET}")
        print(f"{BOLD}{CYAN}======================================{RESET}\n")
        
        print(f"{YELLOW}Next steps:{RESET}")
        print(f"1. Check the DoS detector logs for alerts")
        print(f"2. Verify if attacks were properly detected")
        print(f"3. Check if IPs were successfully blocked")
        if self.api_url:
            print(f"4. Check your API endpoints for successful reports")
        print()


def main():
    """Main function"""
    # Parse command line arguments
    parser = argparse.ArgumentParser(description='DoS Firewall Test Harness')
    
    parser.add_argument('--firewall', default='firewall.py',
                      help='Path to firewall/DoS detector script (default: firewall.py)')
    
    parser.add_argument('--attack', default='simulator.py',
                      help='Path to attack simulator script (default: simulator.py)')
    
    parser.add_argument('--api', 
                      help='API URL for reporting attacks')
    
    parser.add_argument('--duration', type=int, default=15,
                      help='Duration of each attack in seconds (default: 15)')
    
    parser.add_argument('--intensity', type=int, default=200,
                      help='Attack intensity in packets per second (default: 200)')
    
    parser.add_argument('--verbose', action='store_true',
                      help='Show detailed output from subprocesses')
    
    args = parser.parse_args()
    
    # Check if Python is in PATH
    if not os.path.exists(args.firewall):
        print(f"{RED}[!] Firewall script not found: {args.firewall}{RESET}")
        sys.exit(1)
    
    if not os.path.exists(args.attack):
        print(f"{RED}[!] Attack script not found: {args.attack}{RESET}")
        sys.exit(1)
    
    # Create and run test harness
    harness = FirewallTestHarness(
        firewall_script=args.firewall,
        attack_script=args.attack,
        api_url=args.api,
        duration=args.duration,
        intensity=args.intensity,
        verbose=args.verbose
    )
    
    harness.run_tests()


if __name__ == "__main__":
    # Check for Windows platform
    if sys.platform != 'win32':
        print(f"{YELLOW}[!] Warning: This script is designed for Windows. Some features may not work on other platforms.{RESET}")
    
    main()