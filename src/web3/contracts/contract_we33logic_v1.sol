// SPDX-License-Identifier: MIT
pragma solidity 0.8.32;

interface IERC20 {
    function totalSupply() external view returns (uint256);
    function balanceOf(address account) external view returns (uint256);
    function transfer(address recipient, uint256 amount) external returns (bool);
    function allowance(address owner, address spender) external view returns (uint256);
    function approve(address spender, uint256 amount) external returns (bool);
    function transferFrom(address sender, address recipient, uint256 amount) external returns (bool);
    event Transfer(address indexed from, address indexed to, uint256 value);
    event Approval(address indexed owner, address indexed spender, uint256 value);
}

interface IVWALLET {
    function transferOwnership(address newOwner) external;
    function transferETH(address to, uint256 amount) external;
    function approveToken(address token, address to, uint256 amount) external;
    function transferToken(address token, address to, uint256 amount) external;
}

contract Constant {
    uint256 constant VERSION = 1000;

    address constant ZERO = address(0);
    address constant DEAD = address(0xdead);
    uint256 constant MAX = type(uint256).max;

    IERC20 constant tether = IERC20(0x55d398326f99059fF775485246999027B3197955);
}

contract Storage is Constant {
    address _owner;
    bool _initialized;

    bool launched;

    uint256 globalDirect;
    uint256 latestPosition;

    struct Position {
        uint256 id;
        uint256 parent;
        uint256[] child;
        address owner;
        uint256 rank;
        uint256 value;
        uint256 reborn;
        bool completed;
    }

    mapping (uint256 => Position) position;

    struct User {
        address referrer;
        uint256 latestId;
        uint256 totalId;
        uint256 affiliate;
        uint256 profit;
        uint256 reinvest;
        uint256 toprank;
        uint256 direct;
        mapping (uint256 => uint256) ids;
    }

    mapping (address => User) user;

    struct Rank {
        uint256 affiliate;
        uint256 profit;
        uint256 uprank;
        uint256 reborn;
        uint256 cut;
    }

    mapping (uint256 => Rank) rankdata;

    struct Cut {
        uint256 totalWeight;
        mapping (uint256 => address) treasury;
        mapping (uint256 => uint256) weight;
    }

    mapping (uint256 => Cut) cutdata;

    mapping (uint256 => uint256) totalSeat;
    mapping (uint256 => mapping (address => bool)) isExist;
    mapping (uint256 => mapping (uint256 => address)) seat;
}

contract VirtualAddress is Constant {
    address public _owner;

    modifier onlyOwner() {
        require(_owner == msg.sender, "Only Owner");
        _;
    }
    
    constructor () { _owner = msg.sender; }

    function transferOwnership(address newOwner) public onlyOwner {
        _owner = newOwner;
    }

    function externalCall(address to, uint256 amount, bytes memory data) public onlyOwner {
        (bool success, ) = to.call{value: amount}(data);
        require(success);
    }

    function transferETH(address to, uint256 amount) public onlyOwner {
        (bool success, ) = to.call{value: amount}("");
        require(success);
    }

    function approveToken(address token, address to, uint256 amount) public onlyOwner {
        IERC20(token).approve(to, amount);
    }

    function transferToken(address token, address to, uint256 amount) public onlyOwner {
        IERC20(token).transfer(to, amount);
    }
}

contract WE33_Engine_V1 is Storage {
    struct DappSchema {
        uint256 globalDirect;
        uint256 latestPosition;
        uint256 totalSeat_rank_1;
        uint256 totalSeat_rank_2;
        uint256 totalSeat_rank_3;
        uint256 totalSeat_rank_4;
        uint256 totalSeat_rank_5;
        uint256 totalSeat_rank_6;
    }

    struct AccountSchema {
        address account;
        address referrer;
        uint256 latestId;
        uint256 affiliate;
        uint256 profit;
        uint256 reinvest;
        uint256 toprank;
        uint256 direct;
        uint256[] ids;
    }

    struct PositionSchema {
        uint256 id;
        uint256 parent;
        uint256 left;
        uint256 right;
        uint256 rank;
        uint256 value;
        uint256 reborn;
        bool completed;
        AccountSchema owner;
    }

    modifier onlyOwner() {
        require(_owner == msg.sender, "Only Owner");
        _;
    }

    function initialize(address owner_) public {
        require(!_initialized);
        _initialized = true;
        _owner = owner_;
    }

    function launch() public onlyOwner {
        require(!launched);
        launched = true;

        settingRankData();
        settingCutData();

        placePosition(cutdata[0].treasury[5], 0, true);

        position[1].value = 93000e16;

        checkAutoUprank(1);
        checkAutoUprank(1);
        checkAutoUprank(1);
        checkAutoUprank(1);
        checkAutoUprank(1);
    }

    function settingRankData() internal {
        uint256 i;
        i = 1;
        rankdata[i].affiliate = 0;
        rankdata[i].profit = 450e16;
        rankdata[i].uprank = 1500e16;
        rankdata[i].reborn = 50e16;
        rankdata[i].cut = 0;
        i = 2;
        rankdata[i].affiliate = 0;
        rankdata[i].profit = 1075e16;
        rankdata[i].uprank = 1500e16;
        rankdata[i].reborn = 125e16;
        rankdata[i].cut = 300e16;
        i = 3;
        rankdata[i].affiliate = 0;
        rankdata[i].profit = 2225e16;
        rankdata[i].uprank = 3000e16;
        rankdata[i].reborn = 175e16;
        rankdata[i].cut = 600e16;
        i = 4;
        rankdata[i].affiliate = 2400e16;
        rankdata[i].profit = 2700e16;
        rankdata[i].uprank = 4500e16;
        rankdata[i].reborn = 0;
        rankdata[i].cut = 2400e16;
        i = 5;
        rankdata[i].affiliate = 4800e16;
        rankdata[i].profit = 5400e16;
        rankdata[i].uprank = 9000e16;
        rankdata[i].reborn = 0;
        rankdata[i].cut = 4800e16;
        i = 6;
        rankdata[i].affiliate = 9600e16;
        rankdata[i].profit = 10800e16;
        rankdata[i].uprank = 18000e16;
        rankdata[i].reborn = 0;
        rankdata[i].cut = 9600e16;
    }

    function settingCutData() internal {
        cutdata[0].totalWeight = 10;
        cutdata[1].totalWeight = 20;
        cutdata[0].treasury[0] = address(new VirtualAddress()); // World Pool Rank 6
        cutdata[1].treasury[0] = cutdata[0].treasury[0];
        cutdata[0].weight[0] = 1;
        cutdata[1].weight[0] = 3;
        cutdata[0].treasury[1] = address(new VirtualAddress()); // WE Pool
        cutdata[1].treasury[1] = cutdata[0].treasury[1];
        cutdata[0].weight[1] = 1;
        cutdata[1].weight[1] = 2;
        cutdata[0].treasury[2] = address(new VirtualAddress()); // Matrix Token
        cutdata[1].treasury[2] = cutdata[0].treasury[2];
        cutdata[0].weight[2] = 1;
        cutdata[1].weight[2] = 1;
        cutdata[0].treasury[3] = address(new VirtualAddress()); // WE Token LP
        cutdata[1].treasury[3] = cutdata[0].treasury[3];
        cutdata[0].weight[3] = 2;
        cutdata[1].weight[3] = 6;
        cutdata[0].treasury[4] = address(new VirtualAddress()); // Investors Pool
        cutdata[1].treasury[4] = cutdata[0].treasury[4];
        cutdata[0].weight[4] = 1;
        cutdata[1].weight[4] = 2;
        cutdata[0].treasury[5] = address(new VirtualAddress()); // ID1
        cutdata[1].treasury[5] = cutdata[0].treasury[5];
        cutdata[0].weight[5] = 1;
        cutdata[1].weight[5] = 2;
        cutdata[0].treasury[6] = address(new VirtualAddress()); // GAS
        cutdata[1].treasury[6] = cutdata[0].treasury[6];
        cutdata[0].weight[6] = 2;
        cutdata[1].weight[6] = 2;
        cutdata[0].treasury[7] = address(new VirtualAddress()); // MKT
        cutdata[1].treasury[7] = cutdata[0].treasury[7];
        cutdata[0].weight[7] = 1;
        cutdata[1].weight[7] = 2;
        cutdata[2].treasury[0] = 0x3Ff5e13EfEdeC035E7602b6D73B95bBc0654Bd8d;
        cutdata[2].treasury[1] = 0x2B7d1004D17174c6f633cd5A06F8F70F9ee741C4;
        cutdata[2].treasury[2] = address(new VirtualAddress()); // ID2
        cutdata[2].treasury[3] = address(new VirtualAddress()); // ID3
    }

    function getProxyInfo() public view returns (bool, address, uint256) {
        return (_initialized, _owner, VERSION);
    }

    function getReferrerData(uint256 referrerId) public view returns (address) {
        address result = position[referrerId].owner;
        require(result != ZERO, "Referrer Id Not Exist");
        return result;
    }

    function getVirtualWalletInfo() public view returns (address[] memory, uint256[] memory) {
        address[] memory accounts = new address[](10);
        uint256[] memory amounts = new uint256[](10);
        for (uint256 i; i < 8; i++) {
            accounts[i] = cutdata[0].treasury[i];
            amounts[i] = tether.balanceOf(accounts[i]);
        }
        accounts[8] = cutdata[2].treasury[2];
        amounts[8] = tether.balanceOf(accounts[8]);
        accounts[9] = cutdata[2].treasury[3];
        amounts[9] = tether.balanceOf(accounts[9]);
        return (accounts, amounts);
    }

    function getDappData() public view returns (DappSchema memory) {
        return DappSchema(
            globalDirect,
            latestPosition,
            totalSeat[1],
            totalSeat[2],
            totalSeat[3],
            totalSeat[4],
            totalSeat[5],
            totalSeat[6]
        );
    }

    function getSpotsData(address account, uint256 id) public view returns (PositionSchema[] memory) {
        if (account != ZERO && id == 0) { id = user[account].latestId; }
        PositionSchema[] memory spots = new PositionSchema[](16);
        spots[0] = getPositionSchema(position[id].parent);
        spots[1] = getPositionSchema(id);
        spots[2] = getPositionSchema(spots[1].left);
        spots[3] = getPositionSchema(spots[1].right);
        spots[4] = getPositionSchema(spots[2].left);
        spots[5] = getPositionSchema(spots[2].right);
        spots[6] = getPositionSchema(spots[3].left);
        spots[7] = getPositionSchema(spots[3].right);
        spots[8] = getPositionSchema(spots[4].left);
        spots[9] = getPositionSchema(spots[4].right);
        spots[10] = getPositionSchema(spots[5].left);
        spots[11] = getPositionSchema(spots[5].right);
        spots[12] = getPositionSchema(spots[6].left);
        spots[13] = getPositionSchema(spots[6].right);
        spots[14] = getPositionSchema(spots[7].left);
        spots[15] = getPositionSchema(spots[7].right);
        return spots;
    }

    function getPositionSchema(uint256 id) public view returns (PositionSchema memory) {
        bool isHasL = position[id].child.length > 0;
        bool isHasR = position[id].child.length > 1;
        if (id == 0) {
            isHasL = false;
            isHasR = false;
        }
        return PositionSchema(
            id,
            position[id].parent,
            (isHasL) ? position[id].child[0] : 0,
            (isHasR) ? position[id].child[1] : 0,
            position[id].rank,
            position[id].value,
            position[id].reborn,
            position[id].completed,
            getAccountSchema(position[id].owner)
        );
    }

    function getAccountSchema(address account) public view returns (AccountSchema memory) {
        uint256 len = user[account].totalId + 1;
        uint256[] memory ids = new uint256[](len);
        for (uint256 i; i < len; i++) {
            ids[i] = user[account].ids[i];
        }
        return AccountSchema(
            account,
            user[account].referrer,
            user[account].latestId,
            user[account].affiliate,
            user[account].profit,
            user[account].reinvest,
            user[account].toprank,
            user[account].direct,
            ids
        );
    }

    function register(address account, address referrer) public payable {
        uint256 parent = user[referrer].latestId;

        address sender = msg.sender;
        uint256 amount = 2000e16;
        uint256 allowance = tether.allowance(sender, address(this));
        uint256 balance = tether.balanceOf(sender);

        require(allowance >= amount, "Please Approve Payment Token First");
        require(balance >= amount, "Not Enough Tether");

        tether.transferFrom(sender, address(this), amount);

        require(user[account].latestId == 0, "This Account Regitered");
        require(parent > 0, "Referrer Must Register First");
        user[account].referrer = referrer;
        user[referrer].direct++;
        globalDirect++;
        placePosition(account, parent, false);

        sendGasWallet(_owner);
    }

    function findPosition(uint256 parent) public view returns (uint256) {
        uint256[] memory child = position[parent].child;
        if (child.length < 2) { return parent; }

        for (uint256 i; i < 2; i++) {
            if (position[child[i]].child.length < 2) { return child[i]; }
        }

        uint256[] memory branch2 = new uint256[](4);

        for (uint256 i; i < 2; i++) {
            branch2[i * 2]     = position[child[i]].child[0];
            branch2[i * 2 + 1] = position[child[i]].child[1];
        }

        for (uint256 i; i < 4; i++) {
            if (position[branch2[i]].child.length < 2) { return branch2[i]; }
        }

        uint256[] memory branch3 = new uint256[](8);

        for (uint256 i; i < 4; i++) {
            branch3[i * 2]     = position[branch2[i]].child[0];
            branch3[i * 2 + 1] = position[branch2[i]].child[1];
        }

        for (uint256 i; i < 8; i++) {
            if (position[branch3[i]].child.length < 2) { return branch3[i]; }
        }

        uint256[] memory branch4 = new uint256[](16);

        for (uint256 i; i < 8; i++) {
            branch4[i * 2]     = position[branch3[i]].child[0];
            branch4[i * 2 + 1] = position[branch3[i]].child[1];
        }

        for (uint256 i; i < 16; i++) {
            if (position[branch4[i]].child.length < 2) { return branch4[i]; }
        }

        uint256[] memory branch5 = new uint256[](32);

        for (uint256 i; i < 16; i++) {
            branch5[i * 2]     = position[branch4[i]].child[0];
            branch5[i * 2 + 1] = position[branch4[i]].child[1];
        }

        for (uint256 i; i < 32; i++) {
            if (position[branch5[i]].child.length < 2) { return branch5[i]; }
        }

        return 0;
    }

    function findOverhead(uint256 fromId, uint256 rank) public view returns (uint256) {
        uint256 result = fromId;
        if (fromId == 0) { return fromId; }
        for (uint256 i; i < rank; i++) {
            result = position[result].parent;
        }
        return result;
    }

    function placePosition(address account, uint256 parent, bool init) internal {
        latestPosition++;
        uint256 id = latestPosition;
        uint256 find = findPosition(parent);

        if (!init) { require(find > 0, "Not Found Position"); }

        position[id].parent = find;
        position[id].owner = account;
        position[id].rank = 1;

        position[find].child.push(id);

        user[account].totalId++;
        user[account].latestId = id;

        uint256 count = user[account].totalId;
        user[account].ids[count] = id;

        sendPositionValue(id);
    }

    function sendPositionValue(uint256 fromId) internal {
        uint256 rank = position[fromId].rank;
        uint256 affiliate = rankdata[rank].affiliate;

        address from = position[fromId].owner;
        if (user[from].toprank < rank) {
            user[from].toprank = rank;
            if (!isExist[rank][from]) {
                isExist[rank][from] = true;
                uint256 i = totalSeat[rank];
                seat[rank][i] = from;
                totalSeat[rank]++;
            }
        }

        if (fromId == 1) { return; }

        uint256 toId = findOverhead(fromId, rank);
        address to = position[toId].owner;
        address referrer = user[from].referrer;
        processSendCut(rank, rankdata[rank].cut);

        if (user[referrer].toprank >= rank) {
            user[referrer].affiliate += affiliate;
            safeTransferERC20(referrer, affiliate * 9 / 10);
            processNoRef(affiliate / 10);
        } else {
            processNoRef(affiliate);
        }

        if (to != ZERO) {
            user[to].profit += rankdata[rank].profit;
            position[toId].reborn += rankdata[rank].reborn;
            safeTransferERC20(to, rankdata[rank].profit * 9 / 10);
            processNoRef(rankdata[rank].profit / 10);
            safeAddRankBalance(to, toId, rankdata[rank].uprank);
            checkAutoUprank(toId);
            checkAutoReborn(toId);
        } else {
            processNoRef(rankdata[rank].profit + rankdata[rank].uprank + rankdata[rank].reborn);
        }
    }

    function safeAddRankBalance(address to, uint256 toId, uint256 amount) internal {
        position[toId].value += amount;
        uint256 value = position[toId].value;
        if (value > 93000e16) {
            uint256 diff = value - 93000e16;
            position[toId].value -= diff;
            processRankOverflow(to, diff);
        }
    }

    function checkAutoUprank(uint256 beingUprankId) internal {
        uint256 nextRank = position[beingUprankId].rank + 1;
        uint256 currentValue = position[beingUprankId].value;
        uint256 needValue = getRankValue(nextRank);
        if (currentValue >= needValue) {
            position[beingUprankId].rank = nextRank;
            sendPositionValue(beingUprankId);
        }
    }

    function checkAutoReborn(uint256 beingRebornId) internal {
        if (!position[beingRebornId].completed && position[beingRebornId].reborn >= 2000e16) {
            reinvest(beingRebornId);
        }
    }

    function getRankValue(uint256 rank) internal pure returns (uint256) {
        if (rank == 2) { return 3000e16; }
        if (rank == 3) { return 9000e16; }
        if (rank == 4) { return 21000e16; }
        if (rank == 5) { return 45000e16; }
        if (rank == 6) { return 93000e16; }
        return MAX;
    }

    function paidForNextRank(uint256 id) public payable {
        require(position[id].rank < 6, "Maximumed Rank 6");

        uint256 nextRank = position[id].rank + 1;
        uint256 currentValue = position[id].value;
        uint256 needValue = getRankValue(nextRank);

        uint256 paymentAmount = needValue - currentValue;

        address sender = msg.sender;
        uint256 amount = paymentAmount;
        uint256 allowance = tether.allowance(sender, address(this));
        uint256 balance = tether.balanceOf(sender);

        require(allowance >= amount, "Please Approve Payment Token First");
        require(balance >= amount, "Not Enough Tether");

        tether.transferFrom(sender, address(this), amount);

        position[id].value += paymentAmount;

        checkAutoUprank(id);
    }

    function reinvest(uint256 id) internal {
        address account = position[id].owner;
        address referrer = user[account].referrer;
        if (referrer == ZERO) {
            address genesisL = position[2].owner;
            address genesisR = position[3].owner;
            if (user[genesisL].totalId > user[genesisR].totalId) {
                referrer = genesisR;
            } else {
                referrer = genesisL;
            }
        }
        uint256 parent = user[referrer].latestId;
        position[id].completed = true;
        placePosition(account, parent, false);
    }

    function processRankOverflow(address to, uint256 amount) internal {
        uint256 commission = amount / 10;
        amount = amount - commission;
        safeTransferERC20(to, amount / 2);
        safeTransferERC20(cutdata[0].treasury[0], amount / 4);
        safeTransferERC20(cutdata[0].treasury[1], amount / 4);
        processNoRef(commission);
    }

    function processNoRef(uint256 amount) internal {
        safeTransferERC20(cutdata[2].treasury[0], amount / 2);
        safeTransferERC20(cutdata[2].treasury[1], amount / 2);
    }

    function processSendCut(uint256 rank, uint256 amount) internal {
        if (amount == 0) { return; }
        uint256 index = (rank < 4) ? 0 : 1;
        for (uint256 i; i < 8; i++) {
            uint256 amountToSend = amount * cutdata[index].weight[i] / cutdata[index].totalWeight;
            safeTransferERC20(cutdata[index].treasury[i], amountToSend);
        }
    }

    function safeTransferERC20(address to, uint256 amount) internal {
        if (to == ZERO || to == DEAD) { to = _owner; }
        if (amount == 0) { return; }
        tether.transfer(to, amount);
    }

    function sendGasWallet(address to) internal {
        if (address(this).balance > 0) {
            (bool success, ) = to.call{value: address(this).balance}("");
            require(success, "send Gas fail");
        }
    }

    function approveReactWallet(address virtualWallet, address token, address to, uint256 amount) public onlyOwner {
        IVWALLET(virtualWallet).approveToken(token, to, amount);
    }

    function transferReactWallet(address virtualWallet, address token, address to, uint256 amount) public onlyOwner {
        IVWALLET(virtualWallet).transferToken(token, to, amount);
    }

    receive() external payable {}
}