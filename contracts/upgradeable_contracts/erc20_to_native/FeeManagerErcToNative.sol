pragma solidity 0.4.24;

import "../BaseFeeManager.sol";
import "../../IBlockReward.sol";
import "../Sacrifice.sol";


contract FeeManagerErcToNative is BaseFeeManager {

    function getFeeManagerMode() public pure returns(bytes4) {
        return bytes4(keccak256(abi.encodePacked("manages-both-directions")));
    }

    function blockRewardContract() internal view returns(IBlockReward) {
        return IBlockReward(addressStorage[keccak256(abi.encodePacked("blockRewardContract"))]);
    }

    function onAffirmationFeeDistribution(address _rewardAddress, uint256 _fee) internal {
        IBlockReward blockReward = blockRewardContract();
        blockReward.addExtraReceiver(_fee, _rewardAddress);
    }

    function onSignatureFeeDistribution(address _rewardAddress, uint256 _fee) internal {
        if (!_rewardAddress.send(_fee)) {
            (new Sacrifice).value(_fee)(_rewardAddress);
        }
    }

    function isPOSDAOFeeManager() public pure returns(bool) {
        return false;
    }
}
