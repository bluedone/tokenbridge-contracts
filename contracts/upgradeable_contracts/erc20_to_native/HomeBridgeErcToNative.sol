pragma solidity 0.4.24;
import "../../libraries/SafeMath.sol";
import "../../libraries/Message.sol";
import "../BasicBridge.sol";
import "../../upgradeability/EternalStorage.sol";
import "../../IBlockReward.sol";
import "../../ERC677Receiver.sol";
import "../BasicHomeBridge.sol";
import "../ERC677Bridge.sol";


contract HomeBridgeErcToNative is EternalStorage, BasicBridge, BasicHomeBridge {

    function () public payable {
        require(msg.value > 0);
        require(msg.data.length == 0);
        require(withinLimit(msg.value));
        IBlockReward blockReward = blockRewardContract();
        uint256 totalMinted = blockReward.mintedTotallyByBridge(address(this));
        require(msg.value <= totalMinted.sub(totalBurntCoins()));
        setTotalSpentPerDay(getCurrentDay(), totalSpentPerDay(getCurrentDay()).add(msg.value));
        uint256 valueToTransfer = msg.value;
        address feeManager = feeManagerContract();
        if (feeManager != address(0)) {
            uint256 fee = calculateFee(valueToTransfer, false, feeManager);
            valueToTransfer = valueToTransfer - fee;
        }
        setTotalBurntCoins(totalBurntCoins().add(valueToTransfer));
        address(0).transfer(valueToTransfer);
        emit UserRequestForSignature(msg.sender, valueToTransfer);
    }

    function initialize (
        address _validatorContract,
        uint256 _dailyLimit,
        uint256 _maxPerTx,
        uint256 _minPerTx,
        uint256 _homeGasPrice,
        uint256 _requiredBlockConfirmations,
        address _blockReward

    ) public returns(bool)
    {
        require(!isInitialized());
        require(_validatorContract != address(0) && isContract(_validatorContract));
        require(_requiredBlockConfirmations > 0);
        require(_minPerTx > 0 && _maxPerTx > _minPerTx && _dailyLimit > _maxPerTx);
        require(_blockReward == address(0) || isContract(_blockReward));
        addressStorage[keccak256(abi.encodePacked("validatorContract"))] = _validatorContract;
        uintStorage[keccak256(abi.encodePacked("deployedAtBlock"))] = block.number;
        uintStorage[keccak256(abi.encodePacked("dailyLimit"))] = _dailyLimit;
        uintStorage[keccak256(abi.encodePacked("maxPerTx"))] = _maxPerTx;
        uintStorage[keccak256(abi.encodePacked("minPerTx"))] = _minPerTx;
        uintStorage[keccak256(abi.encodePacked("gasPrice"))] = _homeGasPrice;
        uintStorage[keccak256(abi.encodePacked("requiredBlockConfirmations"))] = _requiredBlockConfirmations;
        addressStorage[keccak256(abi.encodePacked("blockRewardContract"))] = _blockReward;
        setInitialize(true);

        return isInitialized();
    }

    function getBridgeMode() public pure returns(bytes4 _data) {
        return bytes4(keccak256(abi.encodePacked("erc-to-native-core")));
    }

    function blockRewardContract() public view returns(IBlockReward) {
        return IBlockReward(addressStorage[keccak256(abi.encodePacked("blockRewardContract"))]);
    }

    function totalBurntCoins() public view returns(uint256) {
        return uintStorage[keccak256(abi.encodePacked("totalBurntCoins"))];
    }

    function setBlockRewardContract(address _blockReward) public onlyOwner {
        require(_blockReward != address(0) && isContract(_blockReward) && (IBlockReward(_blockReward).bridgesAllowedLength() != 0));
        addressStorage[keccak256(abi.encodePacked("blockRewardContract"))] = _blockReward;
    }

    function onExecuteAffirmation(address _recipient, uint256 _value) internal returns(bool) {
        IBlockReward blockReward = blockRewardContract();
        require(blockReward != address(0));
        uint256 valueToMint = _value;

        address feeManager = feeManagerContract();
        if (feeManager != address(0)) {
            uint256 fee = calculateFee(valueToMint, false, feeManager);
            feeManager.delegatecall(abi.encodeWithSignature("distributeFeeFromAffirmation(uint256)", fee));
            valueToMint = valueToMint - fee;
        }

        blockReward.addExtraReceiver(valueToMint, _recipient);
        return true;
    }

    function fireEventOnTokenTransfer(address _from, uint256 _value) internal {
        emit UserRequestForSignature(_from, _value);
    }

    function setTotalBurntCoins(uint256 _amount) internal {
        uintStorage[keccak256(abi.encodePacked("totalBurntCoins"))] = _amount;
    }

    function setFee(uint256 _fee) external onlyOwner {
        require(feeManagerContract().delegatecall(abi.encodeWithSignature("setFee(uint256)", _fee)));
    }

    function getFee() public view returns(uint256) {
        return uintStorage[keccak256(abi.encodePacked("fee"))];
    }
}
