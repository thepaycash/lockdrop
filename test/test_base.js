const { time } = require('openzeppelin-test-helpers');

const LockDropContract = artifacts.require("LockDrop");
const COLTokenContract = artifacts.require("COLToken");

contract('COLToken with LockDrop', async(accounts) => {
    let actors = {
        tokenOwner: accounts[0],
        locker1: accounts[1],
        locker2: accounts[2],
        locker3: accounts[3],
        locker4: accounts[4],
        locker5: accounts[5],
        malicious: accounts[6]
    };

    let lockdropInst;
    let tokenInst;
    let contractCreatedTimestamp;
    let lockDeadline;
    let snapshotId;
    let dropStartTimeStamp;
    const totalAmountOfTokenDrop = 20000000000;

    const zeroAddress = "0x0000000000000000000000000000000000000000";

    let expectThrow = async (promise) => {
        try {
            await promise;
        } catch (error) {
            const invalidOpcode = error.message.search('invalid opcode') >= 0;
            const outOfGas = error.message.search('out of gas') >= 0;
            const revert = error.message.search('revert') >= 0;
            assert(
                invalidOpcode || outOfGas || revert,
                "Expected throw, got '" + error + "' instead",
            );
          return;
        }
        assert.fail('Expected throw not received');
    };

    let takeSnapshot = () => {
        return new Promise((resolve, reject) => {
          web3.currentProvider.send({
            jsonrpc: '2.0',
            method: 'evm_snapshot',
            id: new Date().getTime()
          }, (err, snapshotId) => {
            if (err) { return reject(err) }
            return resolve(snapshotId)
          })
        })
    };

    let revertToSnapShot = (id) => {
        return new Promise((resolve, reject) => {
          web3.currentProvider.send({
            jsonrpc: '2.0',
            method: 'evm_revert',
            params: [id],
            id: new Date().getTime()
          }, (err, result) => {
            if (err) { return reject(err) }
            return resolve(result)
          })
        })
    };

    before("preparing env", async() => {
        tokenInst = await COLTokenContract.new(accounts[7], accounts[8], {from: actors.tokenOwner});
        
        //wrong access
        await expectThrow(
            tokenInst.beginLockDrop({from: actors.malicious})
        );

        await tokenInst.beginLockDrop({from: actors.tokenOwner});

        // can't perform lock drop 2 times
        await expectThrow(
            tokenInst.beginLockDrop({from: actors.tokenOwner})
        );
        lockdropAddress = await tokenInst.lockDropContract.call();
        lockdropInst = await LockDropContract.at(lockdropAddress);

        contractCreatedTimestamp = await time.latest();

        console.log("[DEBUG] Token address", tokenInst.address);
        console.log("[DEBUG] LockDrop address", lockdropInst.address);
        console.log("[DEBUG] Contract created at", contractCreatedTimestamp.toString());
    })

    it("shouldn't lock funds", async() => {
        // deadline is out
        let currentSnapshot = await takeSnapshot();
        snapshotId = currentSnapshot['result']

        await time.advanceBlock();
        lockDeadline = contractCreatedTimestamp.add(time.duration.hours(168)); // 7 days
        await time.increaseTo(lockDeadline);

        await expectThrow(
            lockdropInst.lock({from: actors.locker1, value: web3.utils.toWei("1", "ether")})
        );
        await revertToSnapShot(snapshotId);

        // wrong value
        await expectThrow(
            lockdropInst.lock({from: actors.locker1, value: 0})
        );
    });

    it("should lock funds from 5 users", async() => {
        await lockdropInst.lock({from: actors.locker1, value: web3.utils.toWei("1", "ether")});
        let locker1LockInfo1 = await lockdropInst.locks.call(actors.locker1);
        await lockdropInst.lock({from: actors.locker1, value: web3.utils.toWei("1", "ether")});
        let locker1LockInfo2 = await lockdropInst.locks.call(actors.locker1);

        assert.equal(locker1LockInfo1.lockTimestamp.toString(), locker1LockInfo2.lockTimestamp.toString());
        assert.equal(locker1LockInfo2.lockedAmount, web3.utils.toWei("2", "ether"));
        
        await lockdropInst.lock({from: actors.locker2, value: web3.utils.toWei("2", "ether")});
        await lockdropInst.lock({from: actors.locker3, value: web3.utils.toWei("2", "ether")});
        await lockdropInst.lock({from: actors.locker4, value: web3.utils.toWei("2", "ether")});
        await lockdropInst.lock({from: actors.locker5, value: web3.utils.toWei("2", "ether")});

        let lockDropBalance = await web3.eth.getBalance(lockdropInst.address);
        assert.equal(lockDropBalance, web3.utils.toWei("10", "ether"));       
    });

    it("shouldn't claim tokens, but only ether, drop hasn't started yet", async() => {
        // lock period hasn't expire yet
        await expectThrow(
            lockdropInst.claim(web3.utils.toWei("1", "ether"), {from: actors.locker5})
        )
        let locker5LockInfo5 = await lockdropInst.locks.call(actors.locker5);
        await time.increaseTo(locker5LockInfo5.lockTimestamp.add(time.duration.hours(168)));

        await expectThrow(
            lockdropInst.lock({from: actors.locker1, value: web3.utils.toWei("50", "ether")})
        );

        await lockdropInst.claim(web3.utils.toWei("1", "ether"), {from: actors.locker4});
        await lockdropInst.claim(web3.utils.toWei("1", "ether"), {from: actors.locker5});

        // can't claim ETH more than locked
        await expectThrow(
            lockdropInst.claim(web3.utils.toWei("2", "ether"), {from: actors.locker4})
        );

        let lockDropBalance = await web3.eth.getBalance(lockdropInst.address);
        assert.equal(lockDropBalance, web3.utils.toWei("8", "ether"));

        locker5LockInfo5 = await lockdropInst.locks.call(actors.locker5);
        assert.equal(locker5LockInfo5.lockedAmount, web3.utils.toWei("1", "ether"));
        await revertToSnapShot(snapshotId);
    });

    it("should claim tokens and ether back", async() => {
        dropStartTimeStamp = lockDeadline.add(time.duration.hours(168));
        await time.increaseTo(dropStartTimeStamp);

        await lockdropInst.claim(0, {from: actors.locker1});

        // can't claim many times
        await expectThrow(
            lockdropInst.claim(0, {from: actors.locker1})
        );
        await lockdropInst.claim(0, {from: actors.locker2});
        await lockdropInst.claim(0, {from: actors.locker3});
        await lockdropInst.claim(0, {from: actors.locker4});
        await lockdropInst.claim(0, {from: actors.locker5});

        let lockDropBalance = await web3.eth.getBalance(lockdropInst.address);
        assert.equal(lockDropBalance, 0);
    });

    it("check token balances", async() => {
        let balanceLocker1 = await tokenInst.balanceOf(actors.locker1);
        assert.equal(balanceLocker1, 5000000000 * Math.pow(10, 18));
        let balanceLocker2 = await tokenInst.balanceOf(actors.locker2);
        assert.equal(balanceLocker2, 5000000000 * Math.pow(10, 18));
        let balanceLocker3 = await tokenInst.balanceOf(actors.locker3);
        assert.equal(balanceLocker3, 5000000000 * Math.pow(10, 18));
        let balanceLocker4 = await tokenInst.balanceOf(actors.locker4);
        assert.equal(balanceLocker4, 2500000000 * Math.pow(10, 18));
        let balanceLocker5 = await tokenInst.balanceOf(actors.locker5);
        assert.equal(balanceLocker5, 2500000000 * Math.pow(10, 18));

        let balanceOfLockDrop = await tokenInst.balanceOf(lockdropInst.address);
        assert.equal(balanceOfLockDrop.toString(), "0");
    });
})