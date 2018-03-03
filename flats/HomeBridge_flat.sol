pragma solidity 0.4.20;

// File: contracts/BridgeDeploymentAddressStorage.sol

contract BridgeDeploymentAddressStorage {
    uint256 public deployedAtBlock;

    function BridgeDeploymentAddressStorage() public {
        deployedAtBlock = block.number;
    }
}

// File: contracts/IBridgeValidators.sol

interface IBridgeValidators {
    function isValidator(address _validator) public view returns(bool);
    function requiredSignatures() public view returns(uint8);
}

// File: contracts/Validatable.sol

contract Validatable {
    IBridgeValidators public validatorContract;

    modifier onlyValidator() {
        require(validatorContract.isValidator(msg.sender));
        _;
    }

    function Validatable(address _validatorContract) public {
        require(_validatorContract != address(0));
        validatorContract = IBridgeValidators(_validatorContract);
    }
}

// File: contracts/libraries/Message.sol

library Message {
    // layout of message :: bytes:
    // offset  0: 32 bytes :: uint256 - message length
    // offset 32: 20 bytes :: address - recipient address
    // offset 52: 32 bytes :: uint256 - value
    // offset 84: 32 bytes :: bytes32 - transaction hash
    // offset 116: 32 bytes :: uint256 - home gas price

    // bytes 1 to 32 are 0 because message length is stored as little endian.
    // mload always reads 32 bytes.
    // so we can and have to start reading recipient at offset 20 instead of 32.
    // if we were to read at 32 the address would contain part of value and be corrupted.
    // when reading from offset 20 mload will read 12 zero bytes followed
    // by the 20 recipient address bytes and correctly convert it into an address.
    // this saves some storage/gas over the alternative solution
    // which is padding address to 32 bytes and reading recipient at offset 32.
    // for more details see discussion in:
    // https://github.com/paritytech/parity-bridge/issues/61

    function getRecipient(bytes message) internal pure returns (address) {
        address recipient;
        // solium-disable-next-line security/no-inline-assembly
        assembly {
            recipient := mload(add(message, 20))
        }
        return recipient;
    }

    function getValue(bytes message) internal pure returns (uint256) {
        uint256 value;
        // solium-disable-next-line security/no-inline-assembly
        assembly {
            value := mload(add(message, 52))
        }
        return value;
    }

    function getTransactionHash(bytes message) internal pure returns (bytes32) {
        bytes32 hash;
        // solium-disable-next-line security/no-inline-assembly
        assembly {
            hash := mload(add(message, 84))
        }
        return hash;
    }

    function getHomeGasPrice(bytes message) internal pure returns (uint256) {
        uint256 gasPrice;
        // solium-disable-next-line security/no-inline-assembly
        assembly {
            gasPrice := mload(add(message, 116))
        }
        return gasPrice;
    }
}

// File: contracts/libraries/MessageSigning.sol

// import "./Helpers.sol";
library Helpers {
    function addressArrayContains(address[] array, address value) internal pure returns (bool) {
        for (uint256 i = 0; i < array.length; i++) {
            if (array[i] == value) {
                return true;
            }
        }
        return false;
    }

    function uintToString(uint256 inputValue) internal pure returns (string) {
        // figure out the length of the resulting string
        uint256 length = 0;
        uint256 currentValue = inputValue;
        do {
            length++;
            currentValue /= 10;
        } while (currentValue != 0);
        // allocate enough memory
        bytes memory result = new bytes(length);
        // construct the string backwards
        uint256 i = length - 1;
        currentValue = inputValue;
        do {
            result[i--] = byte(48 + currentValue % 10);
            currentValue /= 10;
        } while (currentValue != 0);
        return string(result);
    }

    function hasEnoughValidSignatures(
        bytes _message,
        uint8[] _vs,
        bytes32[] _rs,
        bytes32[] _ss,
        IBridgeValidators _validatorContract) internal view returns (bool) {
        uint8 _requiredSignatures = _validatorContract.requiredSignatures();
        require(_vs.length < _requiredSignatures);
        bytes32 hash = MessageSigning.hashMessage(_message);
        address[] memory encounteredAddresses = new address[](_requiredSignatures);

        for (uint8 i = 0; i < _requiredSignatures; i++) {
            address recoveredAddress = ecrecover(hash, _vs[i], _rs[i], _ss[i]);
            // only signatures by addresses in `addresses` are allowed
            require(_validatorContract.isValidator(recoveredAddress));
            // duplicate signatures are not allowed
            if (addressArrayContains(encounteredAddresses, recoveredAddress)) {
                return false;
            }
            encounteredAddresses[i] = recoveredAddress;
        }
        return true;
    }
}

library MessageSigning {
    function recoverAddressFromSignedMessage(bytes signature, bytes message) internal pure returns (address) {
        require(signature.length == 65);
        bytes32 r;
        bytes32 s;
        bytes1 v;
        // solium-disable-next-line security/no-inline-assembly
        assembly {
            r := mload(add(signature, 0x20))
            s := mload(add(signature, 0x40))
            v := mload(add(signature, 0x60))
        }
        return ecrecover(hashMessage(message), uint8(v), r, s);
    }

    function hashMessage(bytes message) internal pure returns (bytes32) {
        bytes memory prefix = "\x19Ethereum Signed Message:\n";
        return keccak256(prefix, Helpers.uintToString(message.length), message);
    }
}

// File: contracts/libraries/SafeMath.sol

/**
 * @title SafeMath
 * @dev Math operations with safety checks that throw on error
 */
library SafeMath {

  /**
  * @dev Multiplies two numbers, throws on overflow.
  */
  function mul(uint256 a, uint256 b) internal pure returns (uint256) {
    if (a == 0) {
      return 0;
    }
    uint256 c = a * b;
    assert(c / a == b);
    return c;
  }

  /**
  * @dev Integer division of two numbers, truncating the quotient.
  */
  function div(uint256 a, uint256 b) internal pure returns (uint256) {
    // assert(b > 0); // Solidity automatically throws when dividing by 0
    uint256 c = a / b;
    // assert(a == b * c + a % b); // There is no case in which this doesn't hold
    return c;
  }

  /**
  * @dev Substracts two numbers, throws on overflow (i.e. if subtrahend is greater than minuend).
  */
  function sub(uint256 a, uint256 b) internal pure returns (uint256) {
    assert(b <= a);
    return a - b;
  }

  /**
  * @dev Adds two numbers, throws on overflow.
  */
  function add(uint256 a, uint256 b) internal pure returns (uint256) {
    uint256 c = a + b;
    assert(c >= a);
    return c;
  }
}

// File: contracts/HomeBridge.sol

// import "./libraries/Helpers.sol";







contract HomeBridge is Validatable, BridgeDeploymentAddressStorage {
    using SafeMath for uint256;
    uint256 public gasLimitWithdrawRelay;
    uint256 public estimatedGasCostOfWithdraw;
    mapping (bytes32 => bool) withdraws;

    event GasConsumptionLimitsUpdated(uint256 gas);
    event Deposit (address recipient, uint256 value);
    event Withdraw (address recipient, uint256 value);

    function HomeBridge (
        address _validatorContract
    ) public Validatable(_validatorContract) {
    }

    /// Should be used to deposit money.
    function () public payable {
        Deposit(msg.sender, msg.value);
    }

    function setGasLimitWithdrawRelay(uint256 _gas) public onlyValidator {
        gasLimitWithdrawRelay = _gas;
        GasConsumptionLimitsUpdated(gasLimitWithdrawRelay);
    }

    function withdraw(uint8[] vs, bytes32[] rs, bytes32[] ss, bytes message) public {
        require(message.length == 116);
        // require(Helpers.hasEnoughValidSignatures(message, vs, rs, ss, validatorContract));

        address recipient = Message.getRecipient(message);
        uint256 value = Message.getValue(message);
        bytes32 hash = Message.getTransactionHash(message);
        uint256 homeGasPrice = Message.getHomeGasPrice(message);
        require((recipient == msg.sender) || (tx.gasprice == homeGasPrice));
        require(!withdraws[hash]);
        // Order of operations below is critical to avoid TheDAO-like re-entry bug
        withdraws[hash] = true;

        uint256 estimatedWeiCostOfWithdraw = estimatedGasCostOfWithdraw.mul(homeGasPrice);

        // charge recipient for relay cost
        uint256 valueRemainingAfterSubtractingCost = value.sub(estimatedWeiCostOfWithdraw);

        // pay out recipient
        recipient.transfer(valueRemainingAfterSubtractingCost);

        // refund relay cost to relaying authority
        msg.sender.transfer(estimatedWeiCostOfWithdraw);

        Withdraw(recipient, valueRemainingAfterSubtractingCost);
    }
}
