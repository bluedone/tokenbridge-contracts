var ForeignBridge = artifacts.require("ForeignBridge");
var POA20 = artifacts.require("POA20");

var helpers = require("./helpers/helpers");

contract('ForeignBridge', function(accounts) {
  let token;
  before(async () => {
    token = await POA20.new("POA ERC20 Foundation", "POA20", 18);
  })
  it("should deploy contract", async function() {
    var meta;
    var requiredSignatures = 1;
    var authorities = [accounts[0], accounts[1]];
    return ForeignBridge.new(requiredSignatures, authorities, token.address).then(async function(instance) {
      meta = instance;
      await token.transferOwnership(meta.address);
      return meta.requiredSignatures.call();
    }).then(function(result) {
      assert.equal(requiredSignatures, result, "Contract has invalid number of requiredSignatures");
      return Promise.all(authorities.map((_, index) => meta.authorities.call(index)));
    }).then(function(result) {
      assert.deepEqual(authorities, result, "Contract has invalid authorities");
    })
  })

  it("should fail to deploy contract with not enough required signatures", function() {
    var authorities = [accounts[0], accounts[1]];
    return ForeignBridge.new(0, authorities, token.address).then(function(_) {
      assert(false, "Contract should fail to deploy");
    }, function(err) {
      // do nothing
    })
  })

  it("should fail to deploy contract with to many signatures", function() {
    var authorities = [accounts[0], accounts[1]];
    return ForeignBridge.new(3, authorities, token.address).then(function(_) {
      assert(false, "Contract should fail to deploy");
    }, function(err) {
      // do nothing
    })
  })

  it("should allow a single authority to confirm a deposit", async function() {
    var meta;
    var requiredSignatures = 1;
    var authorities = [accounts[0], accounts[1]];
    var userAccount = accounts[2];
    var value = web3.toWei(1, "ether");
    var hash = "0xe55bb43c36cdf79e23b4adc149cdded921f0d482e613c50c6540977c213bc408";

    let bridge = await ForeignBridge.new(requiredSignatures, authorities, token.address);
    await token.transferOwnership(bridge.address);
    const {logs} = await bridge.deposit(userAccount, value, hash, { from: authorities[0] });
    let totalSupply = await token.totalSupply();
    let balance = await token.balanceOf(userAccount);
    assert.equal(totalSupply.toString(), value);
    assert.equal(balance.toString(), value);
    // Filed issue in truffle: https://github.com/trufflesuite/truffle/issues/795
    // assert.equal(2, result.logs.length)

    // assert.equal("Transfer", result.logs[0].event);
    // assert.equal("0x0000000000000000000000000000000000000000", result.logs[0].args.from);
    // assert.equal(userAccount, result.logs[0].args.to);
    // assert.equal(value, result.logs[0].args.tokens);

    assert.equal("Deposit", logs[0].event);
    assert.equal(userAccount, logs[0].args.recipient);
    assert.equal(value, logs[0].args.value);
  })

  it.only("should require 2 authorities to confirm deposit", function() {
    var meta;
    var requiredSignatures = 2;
    var authorities = [accounts[0], accounts[1]];
    var userAccount = accounts[2];
    var value = web3.toWei(1, "ether");
    var hash = "0xe55bb43c36cdf79e23b4adc149cdded921f0d482e613c50c6540977c213bc408";

    return ForeignBridge.new(requiredSignatures, authorities, token.address).then(async function(instance) {
      meta = instance;
      await token.transferOwnership(meta.address);
      return meta.deposit(userAccount, value, hash, { from: authorities[0] });
    }).then(function(result) {
      assert.equal(0, result.logs.length, "No event should be created");
      return meta.balances.call(userAccount);
    }).then(function(result) {
      assert.equal(web3.toWei(0, "ether"), result, "Contract balance should not change yet");
      return meta.deposit(userAccount, value, hash, { from: authorities[1] });
    }).then(function(result) {
      assert.equal(2, result.logs.length)

      assert.equal("Transfer", result.logs[0].event);
      assert.equal("0x0000000000000000000000000000000000000000", result.logs[0].args.from);
      assert.equal(userAccount, result.logs[0].args.to);
      assert.equal(value, result.logs[0].args.tokens);

      assert.equal("Deposit", result.logs[1].event, "Event name should be Deposit");
      assert.equal(userAccount, result.logs[1].args.recipient, "Event recipient should be transaction sender");
      assert.equal(value, result.logs[1].args.value, "Event value should match deposited ether");
      return meta.balances.call(userAccount);
    }).then(function(result) {
      assert.equal(value, result, "Contract balance should change");
    })
  })

  it("should not be possible to do same deposit twice for same authority", function() {
    var meta;
    var requiredSignatures = 1;
    var authorities = [accounts[0], accounts[1]];
    var userAccount = accounts[2];
    var value = web3.toWei(1, "ether");
    var hash = "0xe55bb43c36cdf79e23b4adc149cdded921f0d482e613c50c6540977c213bc408";

    return ForeignBridge.new(requiredSignatures, authorities, token.address).then(async function(instance) {
      meta = instance;
      await token.transferOwnership(meta.address);
      return meta.deposit(userAccount, value, hash, { from: authorities[0] });
    }).then(function(_) {
      return meta.deposit(userAccount, value, hash, { from: authorities[0] });
    }).then(function(result) {
      assert(false, "doing same deposit twice from same authority should fail");
    }, function(err) {
    })
  })

  it("should not allow non-authorities to execute deposit", function() {
    var meta;
    var requiredSignatures = 1;
    var authorities = [accounts[0], accounts[1]];
    var userAccount = accounts[2];
    var value = web3.toWei(1, "ether");
    var hash = "0xe55bb43c36cdf79e23b4adc149cdded921f0d482e613c50c6540977c213bc408";

    return ForeignBridge.new(requiredSignatures, authorities, token.address).then(async function(instance) {
      meta = instance;
      await token.transferOwnership(meta.address);
      return meta.deposit(userAccount, value, hash, { from: userAccount });
    }).then(function(result) {
      assert(false, "should fail");
    }, function(err) {
    })
  })

  it("should ignore misbehaving authority when confirming deposit", function() {
    var meta;
    var requiredSignatures = 2;
    var authorities = [accounts[0], accounts[1], accounts[2]];
    var userAccount = accounts[3];
    var invalidValue = web3.toWei(2, "ether");
    var value = web3.toWei(1, "ether");
    var hash = "0xe55bb43c36cdf79e23b4adc149cdded921f0d482e613c50c6540977c213bc408";

    return ForeignBridge.new(requiredSignatures, authorities, token.address).then(async function(instance) {
      meta = instance;
      await token.transferOwnership(meta.address);
      return meta.deposit(userAccount, value, hash, { from: authorities[0] });
    }).then(function(result) {
      assert.equal(0, result.logs.length, "No event should be created yet");
      return meta.deposit(userAccount, invalidValue, hash, { from: authorities[1] });
    }).then(function(result) {
      assert.equal(0, result.logs.length, "Misbehaving authority should be ignored");
      return meta.deposit(userAccount, value, hash, { from: authorities[2] })
    }).then(function(result) {
      assert.equal(2, result.logs.length)

      assert.equal("Transfer", result.logs[0].event);
      assert.equal("0x0000000000000000000000000000000000000000", result.logs[0].args.from);
      assert.equal(userAccount, result.logs[0].args.to);
      assert.equal(value, result.logs[0].args.tokens);

      assert.equal("Deposit", result.logs[1].event, "Event name should be Deposit");
      assert.equal(userAccount, result.logs[1].args.recipient, "Event recipient should be transaction sender");
      assert.equal(value, result.logs[1].args.value, "Event value should match transaction value");

      return meta.balances.call(userAccount);
    }).then(function(result) {
      assert.equal(value, result, "Contract balance should change");
    })
  })

  it("should not allow user to transfer value they don't have to home", function() {
    var meta;
    var requiredSignatures = 1;
    var authorities = [accounts[0], accounts[1]];
    var userAccount = accounts[2];
    var recipientAccount = accounts[3];
    var userValue = web3.toWei(3, "ether");
    var transferedValue = web3.toWei(4, "ether");
    var hash = "0xe55bb43c36cdf79e23b4adc149cdded921f0d482e613c50c6540977c213bc408";
    return ForeignBridge.new(requiredSignatures, authorities, token.address).then(async function(instance) {
      meta = instance;
      await token.transferOwnership(meta.address);
      return meta.deposit(userAccount, userValue, hash, { from: authorities[0] });
    }).then(function(result) {
      return meta.transferHomeViaRelay(recipientAccount, transferedValue, { from: userAccount });
    }).then(function(result) {
      assert(false, "transferHomeViaRelay should fail");
    }, function(err) {
    })
  })

  it("should fail to transfer 0 value to home", function() {
    var meta;
    var requiredSignatures = 1;
    var authorities = [accounts[0], accounts[1]];
    var userAccount = accounts[2];
    var recipientAccount = accounts[3];
    var userValue = web3.toWei(3, "ether");
    var transferedValue = web3.toWei(0, "ether");
    var hash = "0xe55bb43c36cdf79e23b4adc149cdded921f0d482e613c50c6540977c213bc408";
    return ForeignBridge.new(requiredSignatures, authorities, token.address).then(async function(instance) {
      meta = instance;
      await token.transferOwnership(meta.address);
      return meta.deposit(userAccount, userValue, hash, { from: authorities[0] });
    }).then(function(result) {
      return meta.transferHomeViaRelay(recipientAccount, transferedValue, { from: userAccount });
    }).then(function(result) {
      assert(false, "transferHomeViaRelay should fail");
    }, function(err) {
    })
  })

  it("should allow user to trigger withdraw", function() {
    var meta;
    var requiredSignatures = 1;
    var authorities = [accounts[0], accounts[1]];
    var userAccount = accounts[2];
    var userAccount2 = accounts[3];
    var value = web3.toWei(3, "ether");
    var value2 = web3.toWei(1, "ether");
    var hash = "0xe55bb43c36cdf79e23b4adc149cdded921f0d482e613c50c6540977c213bc408";
    return ForeignBridge.new(requiredSignatures, authorities, token.address).then(async function(instance) {
      meta = instance;
      await token.transferOwnership(meta.address);
      // top up balance so we can transfer
      return meta.deposit(userAccount, value, hash, { from: authorities[0] });
    }).then(function(result) {
      return meta.transferHomeViaRelay(userAccount2, value2, { from: userAccount });
    }).then(function(result) {
      assert.equal(2, result.logs.length)

      assert.equal("Transfer", result.logs[0].event);
      assert.equal(userAccount, result.logs[0].args.from);
      assert.equal("0x0000000000000000000000000000000000000000", result.logs[0].args.to);
      assert.equal(value2, result.logs[0].args.tokens);

      assert.equal("Withdraw", result.logs[1].event, "Event name should be Withdraw");
      assert.equal(userAccount2, result.logs[1].args.recipient, "Event recipient should be equal to transaction recipient");
      assert.equal(value2, result.logs[1].args.value, "Event value should match transaction value");

      return Promise.all([
        meta.balances.call(userAccount),
        meta.balances.call(userAccount2)
      ])
    }).then(function(result) {
      assert.equal(web3.toWei(2, "ether"), result[0]);
      assert.equal(web3.toWei(0, "ether"), result[1]);
    })
  })

  it("should successfully submit signature and trigger CollectedSignatures event", function() {
    var meta;
    var signature;
    var requiredSignatures = 1;
    var authorities = [accounts[0], accounts[1]];
    var message = "0x111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111";
    return ForeignBridge.new(requiredSignatures, authorities, token.address).then(async function(instance) {
      meta = instance;
      await token.transferOwnership(meta.address);
      return helpers.sign(authorities[0], message);
    }).then(function(result) {
      signature = result;
      return meta.submitSignature(result, message, { from: authorities[0] });
    }).then(function(result) {
      assert.equal(1, result.logs.length, "Exactly one event should be created");
      assert.equal("CollectedSignatures", result.logs[0].event, "Event name should be CollectedSignatures");
      assert.equal(authorities[0], result.logs[0].args.authorityResponsibleForRelay, "Event authority should be equal to transaction sender");
      return Promise.all([
        meta.signature.call(result.logs[0].args.messageHash, 0),
        meta.message(result.logs[0].args.messageHash),
      ])
    }).then(function(result) {
      assert.equal(signature, result[0]);
      assert.equal(message, result[1]);
    })
  })

  it("should successfully submit signature but not trigger CollectedSignatures event", function() {
    var meta;
    var requiredSignatures = 2;
    var authorities = [accounts[0], accounts[1]];
    var message = "0x111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111";
    return ForeignBridge.new(requiredSignatures, authorities, token.address).then(async function(instance) {
      meta = instance;
      await token.transferOwnership(meta.address);
      return helpers.sign(authorities[0], message);
    }).then(function(result) {
      return meta.submitSignature(result, message, { from: authorities[0] });
    }).then(function(result) {
      assert.equal(0, result.logs.length, "No events should be created");
    })
  })

  it("should be able to collect signatures for multiple events in parallel", function() {
    var meta;
    var signatures_for_message = [];
    var signatures_for_message2 = [];
    var requiredSignatures = 2;
    var authorities = [accounts[0], accounts[1]];
    var message = "0x111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111";
    var message2 = "0x111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111112";
    return ForeignBridge.new(requiredSignatures, authorities, token.address).then(async function(instance) {
      meta = instance;
      await token.transferOwnership(meta.address);
      return Promise.all([
        helpers.sign(authorities[0], message),
        helpers.sign(authorities[1], message),
        helpers.sign(authorities[0], message2),
        helpers.sign(authorities[1], message2),
      ]);
    }).then(function(result) {
      signatures_for_message.push(result[0]);
      signatures_for_message.push(result[1]);
      signatures_for_message2.push(result[2]);
      signatures_for_message2.push(result[3]);
      return meta.submitSignature(signatures_for_message[0], message, { from: authorities[0] });
    }).then(function(result) {
      assert.equal(0, result.logs.length, "No events should be created");
      return meta.submitSignature(signatures_for_message2[1], message2, { from: authorities[1] });
    }).then(function(result) {
      assert.equal(0, result.logs.length, "No events should be created");
      return meta.submitSignature(signatures_for_message2[0], message2, { from: authorities[0] });
    }).then(function(result) {
      assert.equal(1, result.logs.length, "Exactly one event should be created");
      assert.equal("CollectedSignatures", result.logs[0].event, "Event name should be CollectedSignatures");
      assert.equal(authorities[0], result.logs[0].args.authorityResponsibleForRelay, "Event authority should be equal to transaction sender");
      return Promise.all([
        meta.signature.call(result.logs[0].args.messageHash, 0),
        meta.signature.call(result.logs[0].args.messageHash, 1),
        meta.message(result.logs[0].args.messageHash),
      ])
    }).then(function(result) {
      assert.equal(signatures_for_message2[1], result[0]);
      assert.equal(signatures_for_message2[0], result[1]);
      assert.equal(message2, result[2]);
      return meta.submitSignature(signatures_for_message[1], message, { from: authorities[1] });
    }).then(function(result) {
      assert.equal(1, result.logs.length, "Exactly one event should be created");
      assert.equal("CollectedSignatures", result.logs[0].event, "Event name should be CollectedSignatures");
      assert.equal(authorities[1], result.logs[0].args.authorityResponsibleForRelay, "Event authority should be equal to transaction sender");
      return Promise.all([
        meta.signature.call(result.logs[0].args.messageHash, 0),
        meta.signature.call(result.logs[0].args.messageHash, 1),
        meta.message(result.logs[0].args.messageHash),
      ])
    }).then(function(result) {
      assert.equal(signatures_for_message[0], result[0]);
      assert.equal(signatures_for_message[1], result[1]);
      assert.equal(message, result[2]);
    })
  })

  it("should not be possible to submit to short message", function() {
    var meta;
    var requiredSignatures = 1;
    var authorities = [accounts[0], accounts[1]];
    var message = "0x1111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111";
    return ForeignBridge.new(requiredSignatures, authorities, token.address).then(async function(instance) {
      meta = instance;
      await token.transferOwnership(meta.address);
      return helpers.sign(authorities[0], message);
    }).then(function(result) {
      return meta.submitSignature(result, message, { from: authorities[0] });
    }).then(function(result) {
      assert(false, "submitSignature should fail");
    }, function (err) {
      // nothing
    })
  })

  it("should not be possible to submit different message then the signed one", function() {
    var meta;
    var requiredSignatures = 1;
    var authorities = [accounts[0], accounts[1]];
    var message = "0x111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111";
    var message2 = "0x111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111112";
    return ForeignBridge.new(requiredSignatures, authorities, token.address).then(async function(instance) {
      meta = instance;
      await token.transferOwnership(meta.address);
      return helpers.sign(authorities[0], message);
    }).then(function(result) {
      return meta.submitSignature(result, message2, { from: authorities[0] });
    }).then(function(result) {
      assert(false, "submitSignature should fail");
    }, function (err) {
      // nothing
    })
  })

  it("should not be possible to submit signature signed by different authority", function() {
    var meta;
    var requiredSignatures = 1;
    var authorities = [accounts[0], accounts[1]];
    var message = "0x111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111";
    return ForeignBridge.new(requiredSignatures, authorities, token.address).then(async function(instance) {
      meta = instance;
      await token.transferOwnership(meta.address);
      return helpers.sign(authorities[0], message);
    }).then(function(result) {
      return meta.submitSignature(result, message, { from: authorities[1] });
    }).then(function(result) {
      assert(false, "submitSignature should fail");
    }, function (err) {
      // nothing
    })
  })

  it("should not be possible to submit signature twice", function() {
    var meta;
    var requiredSignatures = 1;
    var authorities = [accounts[0], accounts[1]];
    var message = "0x111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111";
    var signature;
    return ForeignBridge.new(requiredSignatures, authorities, token.address).then(async function(instance) {
      meta = instance;
      await token.transferOwnership(meta.address);
      return helpers.sign(authorities[0], message);
    }).then(function(result) {
      signature = result;
      return meta.submitSignature(signature, message, { from: authorities[0] });
    }).then(function(_) {
      return meta.submitSignature(signature, message, { from: authorities[0] });
    }).then(function(_) {
      assert(false, "submitSignature should fail");
    }, function (_) {
      // nothing
    })
  })
})
