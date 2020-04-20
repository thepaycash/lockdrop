pragma solidity 0.5.7;

import "../node_modules/openzeppelin-solidity/contracts/token/ERC20/ERC20.sol";
import "../node_modules/openzeppelin-solidity/contracts/ownership/Ownable.sol";
import "../node_modules/openzeppelin-solidity/contracts/math/SafeMath.sol";

import "./LockDrop.sol";

contract COLToken is Ownable, ERC20 {
    using SafeMath for uint256;

    string public constant name    = "COL";
    string public constant symbol  = "COL";
    uint8 public constant decimals = 18;

    // Total supply cap - 200 billions;
    uint256 public constant teamSupply     =  40000000000; // 40 billions
    uint256 public constant lockDropSupply =  20000000000; // 20 billions
    uint256 public constant stakingSupply  = 140000000000; // 140 billions

    LockDrop public lockDropContract;
    address public teamMultisig;
    address public stakingMultisig;

    constructor(address teamMultisig_, address stakingMultisig_) public {
        teamMultisig = teamMultisig_;
        stakingMultisig = stakingMultisig_;

        _mint(teamMultisig, teamSupply * 10**uint256(decimals));
        _mint(stakingMultisig, stakingSupply * 10**uint256(decimals));
    }

    function beginLockDrop() external onlyOwner {
        require(address(lockDropContract) == address(0), "Can't do 2 lock drops");
        lockDropContract = new LockDrop(COLToken(this), lockDropSupply * 10**uint256(decimals));
        _mint(address(lockDropContract), lockDropSupply * 10**uint256(decimals));
    }
}