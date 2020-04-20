pragma solidity 0.5.7;

import "../node_modules/openzeppelin-solidity/contracts/math/SafeMath.sol";

import "./COLToken.sol";

// TODO consider call(), not transfer, due to gas changes in Istanbul fork
contract LockDrop {
    using SafeMath for uint256;

    uint256 lockDeadline;
    uint256 dropStartTimeStamp;
    uint256 totalAmountOfTokenDrop;
    uint256 totalLockedWei;

    COLToken lockingToken;

    struct LockerInfo {
        uint256 lockedAmount;
        uint256 lockTimestamp;
    }
    mapping (address => LockerInfo) public locks;

    event NewLock(address who, uint256 amount);
    event ClaimedETH(address who, uint256 amount);

    constructor(COLToken token, uint256 dropCap) public {
        lockingToken = token;
        totalAmountOfTokenDrop = dropCap;

        lockDeadline = now + 7 days;
        dropStartTimeStamp = lockDeadline + 7 days;
    }

    function lock() external payable {
        require(now < lockDeadline, "Locking action period is expired");
        require(msg.value > 0, "You should stake gt 0 amount of ETH");

        if (locks[msg.sender].lockTimestamp == 0) {
            locks[msg.sender].lockTimestamp = now;
        }
        locks[msg.sender].lockedAmount = locks[msg.sender].lockedAmount.add(msg.value);
        totalLockedWei = totalLockedWei.add(msg.value);

        emit NewLock(msg.sender, msg.value);
    }

    function claim(uint256 amount) external {
        require(hasAmountToClaim(msg.sender), "You don't have ETH or tokens to claim");

        if (now < dropStartTimeStamp) {
            claimETH(msg.sender, amount);
        } else {
            claimTokensAndETH(msg.sender);
        }
    }

    function hasAmountToClaim(address claimer) internal view returns (bool) {
        if (locks[claimer].lockedAmount == 0) {
            return false;
        }
        return true;
    }

    function claimETH(address payable claimer, uint256 amount) internal {
        require(amount > 0, "Claiming amount should be gt 0");

        // alias
        LockerInfo storage lI = locks[claimer];
        if (now >= lI.lockTimestamp + 7 days) {
            lI.lockedAmount = lI.lockedAmount.sub(amount, "Locked less then wanted to be claimed");
            totalLockedWei = totalLockedWei.sub(amount);

            claimer.transfer(amount);

            emit ClaimedETH(claimer, amount);
        } else {
            revert("Lock period hasn't expired yet");
        }
    }

    function claimTokensAndETH(address payable claimer) internal {
        // alias
        LockerInfo storage lI = locks[claimer];
        uint256 tokensForClaimer = totalAmountOfTokenDrop.mul(lI.lockedAmount).div(totalLockedWei);
        uint256 ETHForClaimer = lI.lockedAmount;
        lI.lockedAmount = 0;

        require(lockingToken.transfer(claimer, tokensForClaimer), "Token transfer failed");
        claimer.transfer(ETHForClaimer);

        emit ClaimedETH(claimer, ETHForClaimer);
    }
}
