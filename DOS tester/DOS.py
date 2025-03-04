import asyncio
import aiohttp
import time
from datetime import datetime


class LoadTester:
    def __init__(self, url, max_concurrent=10, test_duration=60):
        self.url = url
        self.max_concurrent = max_concurrent  # Maximum concurrent connections
        self.test_duration = test_duration  # Test duration in seconds
        self.results = []

    async def make_request(self, session, request_id):
        try:
            start_time = time.time()
            async with session.get(self.url) as response:
                response_time = time.time() - start_time
                status = response.status
                self.results.append({
                    'request_id': request_id,
                    'status': status,
                    'response_time': response_time
                })
                print(f"Request {request_id}: Status {status}, Time {response_time:.2f}s")
        except Exception as e:
            print(f"Request {request_id} failed: {str(e)}")

    async def run_load_test(self):
        print(f"Starting load test of {self.url}")
        print(f"Concurrent connections: {self.max_concurrent}")
        print(f"Duration: {self.test_duration} seconds")

        async with aiohttp.ClientSession() as session:
            start_time = time.time()
            request_id = 0
            pending = set()

            while time.time() - start_time < self.test_duration:
                while len(pending) < self.max_concurrent:
                    task = asyncio.create_task(self.make_request(session, request_id))
                    pending.add(task)
                    request_id += 1

                # Wait for at least one task to complete
                done, pending = await asyncio.wait(
                    pending,
                    return_when=asyncio.FIRST_COMPLETED
                )

            # Wait for remaining tasks
            if pending:
                await asyncio.wait(pending)

        self.print_summary()

    def print_summary(self):
        if not self.results:
            print("\nNo results collected!")
            return

        total_requests = len(self.results)
        successful_requests = sum(1 for r in self.results if 200 <= r['status'] < 300)
        avg_response_time = sum(r['response_time'] for r in self.results) / total_requests

        print("\nTest Summary:")
        print(f"Total Requests: {total_requests}")
        print(f"Successful Requests: {successful_requests}")
        print(f"Success Rate: {(successful_requests / total_requests) * 100:.1f}%")
        print(f"Average Response Time: {avg_response_time:.2f}s")


async def main():
    # Configure your test parameters
    url = "http://localhost:5173"  # Replace with your website URL
    max_concurrent =200#Adjust based on your needs
    test_duration = 60  # Test duration in seconds

    tester = LoadTester(url, max_concurrent, test_duration)
    await tester.run_load_test()


if __name__ == "__main__":
    asyncio.run(main())