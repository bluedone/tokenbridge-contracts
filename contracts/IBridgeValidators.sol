pragma solidity 0.4.24;


interface IBridgeValidators {
    function isValidator(address _validator) public view returns(bool);
    function requiredSignatures() public view returns(uint256);
    function owner() public view returns(address);
    function getValidatorRewardAddress(address _validator) public view returns(address);
    function validatorList() public view returns (address[]);
}
