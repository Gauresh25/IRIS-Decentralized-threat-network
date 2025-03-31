pragma solidity ^0.5.0;

contract DosAttackLogger {
    uint public attackCount = 0;
    
    enum AttackType { SYNFLOOD, UDPFLOOD, HTTPFLOOD, ICMPFLOOD, SLOWLORIS, OTHER }
    enum AttackStatus { ACTIVE, MITIGATED, INVESTIGATING, CLOSED }
    
    struct DosAttack {
        uint id;
        string sourceIP;
        string targetService;
        uint timestamp;
        AttackType attackType;
        uint trafficVolume; // in Mbps
        uint duration; // in seconds
        string additionalInfo;
        AttackStatus status;
    }
    
    mapping(uint => DosAttack) public attacks;
    
    event AttackLogged(uint id, string sourceIP, string targetService, uint timestamp);
    event AttackStatusUpdated(uint id, AttackStatus newStatus);
    
    constructor() public {
        // Initialize with empty state
    }
    
    function logAttack(
        string memory _sourceIP,
        string memory _targetService,
        uint _timestamp,
        uint _attackType,
        uint _trafficVolume,
        uint _duration,
        string memory _additionalInfo
    ) public {
        attackCount++;
        attacks[attackCount] = DosAttack(
            attackCount,
            _sourceIP,
            _targetService,
            _timestamp,
            AttackType(_attackType),
            _trafficVolume,
            _duration,
            _additionalInfo,
            AttackStatus.ACTIVE
        );
        
        emit AttackLogged(attackCount, _sourceIP, _targetService, _timestamp);
    }
    
    function updateAttackStatus(uint _id, uint _newStatus) public {
        require(_id > 0 && _id <= attackCount, "Attack ID does not exist");
        require(_newStatus <= uint(AttackStatus.CLOSED), "Invalid status value");
        
        attacks[_id].status = AttackStatus(_newStatus);
        emit AttackStatusUpdated(_id, AttackStatus(_newStatus));
    }
    
    function getAttack(uint _id) public view returns (
        uint id,
        string memory sourceIP,
        string memory targetService,
        uint timestamp,
        uint attackType,
        uint trafficVolume,
        uint duration,
        string memory additionalInfo,
        uint status
    ) {
        require(_id > 0 && _id <= attackCount, "Attack ID does not exist");
        DosAttack memory attack = attacks[_id];
        
        return (
            attack.id,
            attack.sourceIP,
            attack.targetService,
            attack.timestamp,
            uint(attack.attackType),
            attack.trafficVolume,
            attack.duration,
            attack.additionalInfo,
            uint(attack.status)
        );
    }
}