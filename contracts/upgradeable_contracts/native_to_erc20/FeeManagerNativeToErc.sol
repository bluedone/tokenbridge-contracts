pragma solidity 0.4.24;

import "../BaseFeeManager.sol";
import "../../IBurnableMintableERC677Token.sol";
import "../Sacrifice.sol";


contract FeeManagerNativeToErc is BaseFeeManager {

    function erc677token() public view returns(IBurnableMintableERC677Token) {
        return IBurnableMintableERC677Token(addressStorage[keccak256(abi.encodePacked("erc677token"))]);
    }

    function onAffirmationFeeDistribution(address _rewardAddress, uint256 _fee) internal {
        if (!_rewardAddress.send(_fee)) {
            (new Sacrifice).value(_fee)(_rewardAddress);
        }
    }

    function onSignatureFeeDistribution(address _rewardAddress, uint256 _fee) internal {
        erc677token().mint(_rewardAddress, _fee);
    }
}
