import asyncio
import aiohttp
import random
import time
import argparse
from datetime import datetime

class DosSimulator:
    def __init__(self, api_url, target_service, attack_type=None, duration=None):
        self.api_url = api_url
        self.target_service = target_service
        self.attack_type = attack_type or random.choice(['synflood', 'udpflood', 'httpflood', 'icmpflood', 'slowloris'])
        self.duration = duration or random.randint(30, 300)  # 30 seconds to 5 minutes
        
        # Random source IPs (for simulation)
        self.source_ips = [
            f"{random.randint(1, 255)}.{random.randint(1, 255)}.{random.randint(1, 255)}.{random.randint(1, 255)}"
            for _ in range(5)  # Generate 5 random IPs
        ]
        
    async def simulate_attack(self):
        """Simulate a DoS attack and send report to API"""
        print(f"Starting {self.attack_type} simulation against {self.target_service}")
        
        # Choose a random source IP for this attack
        source_ip = f"127.0.0.1"
        
        # Generate random traffic volume based on attack type
        traffic_volumes = {
            'synflood': random.randint(500, 10000),
            'udpflood': random.randint(2000, 25000),
            'httpflood': random.randint(1000, 8000),
            'icmpflood': random.randint(500, 5000),
            'slowloris': random.randint(50, 500)
        }
        
        traffic_volume = traffic_volumes.get(self.attack_type, random.randint(500, 5000))
        
        # Additional info based on attack type
        info_templates = {
            'synflood': f"SYN packets from {source_ip}, port scan detected",
            'udpflood': f"UDP flood targeting ports 53, 80, 443 from {source_ip}",
            'httpflood': f"HTTP GET flood targeting /login and /api endpoints from {source_ip}",
            'icmpflood': f"ICMP Echo (ping) flood from {source_ip}",
            'slowloris': f"Slow HTTP headers attack from {source_ip}, targeting web server"
        }
        
        additional_info = info_templates.get(self.attack_type, f"Attack from {source_ip}")
        
        # Prepare report data
        report_data = {
            "sourceIP": source_ip,
            "targetService": self.target_service,
            "attackType": self.attack_type,
            "trafficVolume": traffic_volume,
            "duration": self.duration,
            "additionalInfo": additional_info
        }
        
        # Print attack details
        print(f"Attack details:")
        print(f"  Source IP: {source_ip}")
        print(f"  Target: {self.target_service}")
        print(f"  Type: {self.attack_type}")
        print(f"  Traffic Volume: {traffic_volume} Mbps")
        print(f"  Duration: {self.duration} seconds")
        print(f"  Additional Info: {additional_info}")
        
        # Send to API
        try:
            async with aiohttp.ClientSession() as session:
                print(f"\nSending attack report to API at {self.api_url}...")
                async with session.post(f"{self.api_url}/api/report-attack", json=report_data) as response:
                    if response.status == 201:
                        result = await response.json()
                        print(f"Report submitted successfully!")
                        print(f"Transaction hash: {result.get('txHash', 'N/A')}")
                    else:
                        error_text = await response.text()
                        print(f"Failed to submit report. Status: {response.status}")
                        print(f"Error: {error_text}")
        except Exception as e:
            print(f"Error sending report: {str(e)}")

async def main():
    parser = argparse.ArgumentParser(description='DoS Attack Simulator and Reporter')
    parser.add_argument('--api', type=str, default='http://localhost:3001', help='API endpoint URL')
    parser.add_argument('--target', type=str, default='web-server-1', help='Target service name')
    parser.add_argument('--type', type=str, choices=['synflood', 'udpflood', 'httpflood', 'icmpflood', 'slowloris'], help='Attack type')
    parser.add_argument('--duration', type=int, help='Attack duration in seconds')
    parser.add_argument('--count', type=int, default=1, help='Number of attack reports to generate')
    parser.add_argument('--delay', type=int, default=5, help='Delay between reports in seconds')
    
    args = parser.parse_args()
    
    for i in range(args.count):
        if i > 0:
            # Wait between attacks if generating multiple
            print(f"\nWaiting {args.delay} seconds before next attack simulation...\n")
            await asyncio.sleep(args.delay)
            
        simulator = DosSimulator(
            api_url=args.api,
            target_service=args.target,
            attack_type=args.type,
            duration=args.duration
        )
        
        await simulator.simulate_attack()
    
    print("\nSimulation complete!")

if __name__ == "__main__":
    asyncio.run(main())