pragma solidity ^0.5.0;

contract SimplifiedPhishingLogger {
    uint public attemptCount = 0;
    
    enum PhishingType { CREDENTIAL_THEFT, FINANCIAL_SCAM, DATA_THEFT, MALWARE_DISTRIBUTION, SOCIAL_ENGINEERING, OTHER }
    enum PhishingStatus { ACTIVE, MITIGATED, INVESTIGATING, CLOSED }
    
    struct PhishingAttempt {
        uint id;
        string sourceEmail;
        string targetDomain;
        uint timestamp;
        PhishingType phishingType; 
        uint severity;
        string contentHash;
        PhishingStatus status;
    }
    
    mapping(uint => PhishingAttempt) public phishingAttempts;
    
    event AttemptLogged(uint id, string sourceEmail, string targetDomain, uint timestamp);
    event AttemptStatusUpdated(uint id, PhishingStatus newStatus);
    
    constructor() public {
        // Initialize with empty state
    }
    
    function logPhishingAttempt(
        string memory _sourceEmail,
        string memory _targetDomain,
        uint _phishingType,
        uint _severity,
        string memory _contentHash
    ) public {
        require(_severity >= 1 && _severity <= 5, "Severity must be between 1 and 5");
        
        attemptCount++;
        uint timestamp = now; // Current block timestamp
        
        phishingAttempts[attemptCount] = PhishingAttempt(
            attemptCount,
            _sourceEmail,
            _targetDomain,
            timestamp,
            PhishingType(_phishingType),
            _severity,
            _contentHash,
            PhishingStatus.ACTIVE
        );
        
        emit AttemptLogged(attemptCount, _sourceEmail, _targetDomain, timestamp);
    }
    
    function updateAttemptStatus(uint _id, uint _newStatus) public {
        require(_id > 0 && _id <= attemptCount, "Attempt ID does not exist");
        require(_newStatus <= uint(PhishingStatus.CLOSED), "Invalid status value");
        
        phishingAttempts[_id].status = PhishingStatus(_newStatus);
        emit AttemptStatusUpdated(_id, PhishingStatus(_newStatus));
    }
    
    function getPhishingAttempt(uint _id) public view returns (
        uint id,
        string memory sourceEmail,
        string memory targetDomain,
        uint timestamp,
        uint phishingType,
        uint severity,
        string memory contentHash,
        uint status
    ) {
        require(_id > 0 && _id <= attemptCount, "Attempt ID does not exist");
        PhishingAttempt storage attempt = phishingAttempts[_id];
        
        return (
            attempt.id,
            attempt.sourceEmail,
            attempt.targetDomain,
            attempt.timestamp,
            uint(attempt.phishingType),
            attempt.severity,
            attempt.contentHash,
            uint(attempt.status)
        );
    }
}