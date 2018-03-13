pragma solidity 0.4.19;
import "./ERC677.sol";


contract IBurnableMintableERC677Token is ERC677 {
    function mint(address, uint256) public returns (bool);
    function burn(uint256 _value) public;
}
