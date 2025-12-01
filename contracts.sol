// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract OnChain2048 {
    address public owner;
    uint256[16] public board; // 4x4 grid flattened
    uint256 public score;
    bool public gameOver;
    uint256 private nonce; // For random tile placement

    event MoveMade(uint256 direction, uint256 newScore);
    event NewTileAdded(uint256 position, uint256 value);

    modifier onlyOwner() {
        require(msg.sender == owner, "Only owner can call this");
        _;
    }

    constructor() {
        owner = msg.sender;
        resetGame();
    }

    function resetGame() public onlyOwner {
        delete board;
        score = 0;
        gameOver = false;
        nonce = 0;
        _addRandomTile();
        _addRandomTile();
    }

    function getBoard() external view returns (uint256[16] memory) {
        return board;
    }

    function move(uint256 direction) external onlyOwner {
        require(!gameOver, "Game over");
        bool moved = false;

        if (direction == 0) moved = _moveUp(); // 0: up
        else if (direction == 1) moved = _moveDown(); // 1: down
        else if (direction == 2) moved = _moveLeft(); // 2: left
        else if (direction == 3) moved = _moveRight(); // 3: right
        else revert("Invalid direction");

        if (moved) {
            _addRandomTile();
            emit MoveMade(direction, score);
            if (_isGameOver()) {
                gameOver = true;
            }
        }
    }

    function _addRandomTile() private {
        uint256 emptyCount = 0;
        for (uint256 i = 0; i < 16; i++) {
            if (board[i] == 0) emptyCount++;
        }
        if (emptyCount == 0) return;

        uint256 pos = _random() % emptyCount;
        uint256 value = (_random() % 10 < 9) ? 2 : 4; // 90% chance of 2, 10% of 4

        uint256 index = 0;
        for (uint256 i = 0; i < 16; i++) {
            if (board[i] == 0) {
                if (index == pos) {
                    board[i] = value;
                    emit NewTileAdded(i, value);
                    return;
                }
                index++;
            }
        }
    }

    function _random() private returns (uint256) {
        nonce++;
        return uint256(keccak256(abi.encodePacked(block.timestamp, block.prevrandao, msg.sender, nonce)));
    }

    function _moveUp() private returns (bool) {
        bool moved = false;
        for (uint256 x = 0; x < 4; x++) {
            uint256[] memory col = new uint256[](4);
            uint256 idx = 0;
            for (uint256 y = 0; y < 4; y++) {
                uint256 val = board[y * 4 + x];
                if (val != 0) col[idx++] = val;
            }
            (bool colMoved, uint256 colScore) = _merge(col, idx);
            if (colMoved) moved = true;
            score += colScore;
            idx = 0;
            for (uint256 y = 0; y < 4; y++) {
                board[y * 4 + x] = (idx < 4) ? col[idx++] : 0;
            }
        }
        return moved;
    }

    function _moveDown() private returns (bool) {
        bool moved = false;
        for (uint256 x = 0; x < 4; x++) {
            uint256[] memory col = new uint256[](4);
            uint256 idx = 0;
            for (int256 y = 3; y >= 0; y--) {
                uint256 val = board[uint256(y) * 4 + x];
                if (val != 0) col[idx++] = val;
            }
            (bool colMoved, uint256 colScore) = _merge(col, idx);
            if (colMoved) moved = true;
            score += colScore;
            idx = 0;
            for (int256 y = 3; y >= 0; y--) {
                board[uint256(y) * 4 + x] = (idx < 4) ? col[idx++] : 0;
            }
        }
        return moved;
    }

    function _moveLeft() private returns (bool) {
        bool moved = false;
        for (uint256 y = 0; y < 4; y++) {
            uint256[] memory row = new uint256[](4);
            uint256 idx = 0;
            for (uint256 x = 0; x < 4; x++) {
                uint256 val = board[y * 4 + x];
                if (val != 0) row[idx++] = val;
            }
            (bool rowMoved, uint256 rowScore) = _merge(row, idx);
            if (rowMoved) moved = true;
            score += rowScore;
            idx = 0;
            for (uint256 x = 0; x < 4; x++) {
                board[y * 4 + x] = (idx < 4) ? row[idx++] : 0;
            }
        }
        return moved;
    }

    function _moveRight() private returns (bool) {
        bool moved = false;
        for (uint256 y = 0; y < 4; y++) {
            uint256[] memory row = new uint256[](4);
            uint256 idx = 0;
            for (int256 x = 3; x >= 0; x--) {
                uint256 val = board[y * 4 + uint256(x)];
                if (val != 0) row[idx++] = val;
            }
            (bool rowMoved, uint256 rowScore) = _merge(row, idx);
            if (rowMoved) moved = true;
            score += rowScore;
            idx = 0;
            for (int256 x = 3; x >= 0; x--) {
                board[y * 4 + uint256(x)] = (idx < 4) ? row[idx++] : 0;
            }
        }
        return moved;
    }

    function _merge(uint256[] memory line, uint256 len) private pure returns (bool moved, uint256 addedScore) {
        if (len == 0) return (false, 0);
        uint256[] memory newLine = new uint256[](4);
        uint256 writeIdx = 0;
        uint256 readIdx = 0;

        while (readIdx < len) {
            if (readIdx + 1 < len && line[readIdx] == line[readIdx + 1] && line[readIdx] != 0) {
                uint256 merged = line[readIdx] * 2;
                newLine[writeIdx++] = merged;
                addedScore += merged;
                readIdx += 2;
                moved = true;
            } else {
                newLine[writeIdx++] = line[readIdx++];
            }
        }

        // Check if the line changed positionally
        for (uint256 i = 0; i < len; i++) {
            if (line[i] != newLine[i]) {
                moved = true;
                break;
            }
        }

        // Pad with zeros if needed, but since we're returning the score and moved, and updating externally
        line[0] = newLine[0];
        line[1] = newLine[1];
        line[2] = newLine[2];
        line[3] = newLine[3];
        return (moved, addedScore);
    }

    function _isGameOver() private view returns (bool) {
        for (uint256 i = 0; i < 16; i++) {
            if (board[i] == 0) return false;
        }
        // Check for possible merges
        for (uint256 y = 0; y < 4; y++) {
            for (uint256 x = 0; x < 3; x++) {
                if (board[y*4 + x] == board[y*4 + x + 1]) return false;
            }
        }
        for (uint256 x = 0; x < 4; x++) {
            for (uint256 y = 0; y < 3; y++) {
                if (board[y*4 + x] == board[(y+1)*4 + x]) return false;
            }
        }
        return true;
    }
}
