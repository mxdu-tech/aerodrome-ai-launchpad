// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity 0.8.24;

import {Math} from "@openzeppelin/contracts/utils/math/Math.sol";
import {IPool} from "./interfaces/IPool.sol";
import {IPoolFactory} from "./interfaces/factories/IPoolFactory.sol";
import {IWETH} from "./interfaces/IWETH.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IERC20Metadata} from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Clones} from "@openzeppelin/contracts/proxy/Clones.sol";

/// @title Protocol Router
/// @author velodrome.finance, Solidly, Uniswap Labs, @pegahcarter
/// @notice Router allows routes through any pools created by any factory adhering to univ2 interface.
contract Router {

    error Expired();
    error OnlyWETH();
    error SameAddresses();
    error ZeroAddress();
    error InsufficientAmount();
    error InsufficientLiquidity();
    error InvalidPath();
    error InsufficientAmountADesired();
    error InsufficientAmountBDesired();
    error InsufficientAmountA();
    error InsufficientAmountB();
    error InsufficientOutputAmount();
    error ETHTransferFailed();

    struct Route {
        address from;
        address to;
        bool stable;
        address factory;
    }

    using SafeERC20 for IERC20;
    
    address public immutable factoryRegistry;
    
    address public immutable defaultFactory;

    
    IWETH public immutable weth;
    uint256 internal constant MINIMUM_LIQUIDITY = 10 ** 3;
    
    address public constant ETHER = 0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE;

    modifier ensure(uint256 deadline) {
        _ensureDeadline(deadline);
        _;
    }

    function _ensureDeadline(uint256 deadline) internal view {
        if (deadline < block.timestamp) revert Expired();
    }

    constructor(
        address _factoryRegistry,
        address _factory,
        address _weth
    ) {
        factoryRegistry = _factoryRegistry;
        defaultFactory = _factory;
        weth = IWETH(_weth);
    }

    receive() external payable {
        if (msg.sender != address(weth)) revert OnlyWETH();
    }

    
    function sortTokens(address tokenA, address tokenB) public pure returns (address token0, address token1) {
        if (tokenA == tokenB) revert SameAddresses();
        (token0, token1) = tokenA < tokenB ? (tokenA, tokenB) : (tokenB, tokenA);
        if (token0 == address(0)) revert ZeroAddress();
    }

    
    function poolFor(address tokenA, address tokenB, bool stable, address _factory) public view returns (address pool) {
        address _defaultFactory = defaultFactory;
        address factory = _factory == address(0) ? _defaultFactory : _factory;
  
        (address token0, address token1) = sortTokens(tokenA, tokenB);
        bytes32 salt = keccak256(abi.encodePacked(token0, token1, stable));
        pool = Clones.predictDeterministicAddress(IPoolFactory(factory).implementation(), salt, factory);
    }

    /// @dev given some amount of an asset and pool reserves, returns an equivalent amount of the other asset
    /// @dev this only accounts for volatile pools and may return insufficient liquidity for stable pools
    function quoteLiquidity(
        uint256 amountA,
        uint256 reserveA,
        uint256 reserveB
    ) internal pure returns (uint256 amountB) {
        if (amountA == 0) revert InsufficientAmount();
        if (reserveA == 0 || reserveB == 0) revert InsufficientLiquidity();
        amountB = (amountA * reserveB) / reserveA;
    }

    
    function getReserves(
        address tokenA,
        address tokenB,
        bool stable,
        address _factory
    ) public view returns (uint256 reserveA, uint256 reserveB) {
        (address token0, ) = sortTokens(tokenA, tokenB);
        (uint256 reserve0, uint256 reserve1, ) = IPool(poolFor(tokenA, tokenB, stable, _factory)).getReserves();
        (reserveA, reserveB) = tokenA == token0 ? (reserve0, reserve1) : (reserve1, reserve0);
    }

    
    function getAmountsOut(uint256 amountIn, Route[] memory routes) public view returns (uint256[] memory amounts) {
        if (routes.length < 1) revert InvalidPath();
        amounts = new uint256[](routes.length + 1);
        amounts[0] = amountIn;
        uint256 _length = routes.length;
        for (uint256 i = 0; i < _length; i++) {
            address factory = routes[i].factory == address(0) ? defaultFactory : routes[i].factory; // default to v2
            address pool = poolFor(routes[i].from, routes[i].to, routes[i].stable, factory);
            if (IPoolFactory(factory).isPool(pool)) {
                amounts[i + 1] = IPool(pool).getAmountOut(amounts[i], routes[i].from);
            }
        }
    }

    
    function quoteAddLiquidity(
        address tokenA,
        address tokenB,
        bool stable,
        address _factory,
        uint256 amountADesired,
        uint256 amountBDesired
    ) public view returns (uint256 amountA, uint256 amountB, uint256 liquidity) {
        address _pool = IPoolFactory(_factory).getPool(tokenA, tokenB, stable);
        (uint256 reserveA, uint256 reserveB) = (0, 0);
        uint256 _totalSupply = 0;
        if (_pool != address(0)) {
            _totalSupply = IERC20(_pool).totalSupply();
            (reserveA, reserveB) = getReserves(tokenA, tokenB, stable, _factory);
        }
        if (reserveA == 0 && reserveB == 0) {
            (amountA, amountB) = (amountADesired, amountBDesired);
            liquidity = Math.sqrt(amountA * amountB) - MINIMUM_LIQUIDITY;
        } else {
            uint256 amountBOptimal = quoteLiquidity(amountADesired, reserveA, reserveB);
            if (amountBOptimal <= amountBDesired) {
                (amountA, amountB) = (amountADesired, amountBOptimal);
                liquidity = Math.min((amountA * _totalSupply) / reserveA, (amountB * _totalSupply) / reserveB);
            } else {
                uint256 amountAOptimal = quoteLiquidity(amountBDesired, reserveB, reserveA);
                (amountA, amountB) = (amountAOptimal, amountBDesired);
                liquidity = Math.min((amountA * _totalSupply) / reserveA, (amountB * _totalSupply) / reserveB);
            }
        }
    }

    
    function quoteRemoveLiquidity(
        address tokenA,
        address tokenB,
        bool stable,
        address _factory,
        uint256 liquidity
    ) public view returns (uint256 amountA, uint256 amountB) {
        address _pool = IPoolFactory(_factory).getPool(tokenA, tokenB, stable);

        if (_pool == address(0)) {
            return (0, 0);
        }

        (uint256 reserveA, uint256 reserveB) = getReserves(tokenA, tokenB, stable, _factory);
        uint256 _totalSupply = IERC20(_pool).totalSupply();

        amountA = (liquidity * reserveA) / _totalSupply; // using balances ensures pro-rata distribution
        amountB = (liquidity * reserveB) / _totalSupply; // using balances ensures pro-rata distribution
    }

    function _addLiquidity(
        address tokenA,
        address tokenB,
        bool stable,
        uint256 amountADesired,
        uint256 amountBDesired,
        uint256 amountAMin,
        uint256 amountBMin
    ) internal returns (uint256 amountA, uint256 amountB) {
        if (amountADesired < amountAMin) revert InsufficientAmountADesired();
        if (amountBDesired < amountBMin) revert InsufficientAmountBDesired();
        // create the pool if it doesn't exist yet
        address _pool = IPoolFactory(defaultFactory).getPool(tokenA, tokenB, stable);
        if (_pool == address(0)) {
            _pool = IPoolFactory(defaultFactory).createPool(tokenA, tokenB, stable);
        }
        (uint256 reserveA, uint256 reserveB) = getReserves(tokenA, tokenB, stable, defaultFactory);
        if (reserveA == 0 && reserveB == 0) {
            (amountA, amountB) = (amountADesired, amountBDesired);
        } else {
            uint256 amountBOptimal = quoteLiquidity(amountADesired, reserveA, reserveB);
            if (amountBOptimal <= amountBDesired) {
                if (amountBOptimal < amountBMin) revert InsufficientAmountB();
                (amountA, amountB) = (amountADesired, amountBOptimal);
            } else {
                uint256 amountAOptimal = quoteLiquidity(amountBDesired, reserveB, reserveA);
                assert(amountAOptimal <= amountADesired);
                if (amountAOptimal < amountAMin) revert InsufficientAmountA();
                (amountA, amountB) = (amountAOptimal, amountBDesired);
            }
        }
    }

    
    function addLiquidity(
        address tokenA,
        address tokenB,
        bool stable,
        uint256 amountADesired,
        uint256 amountBDesired,
        uint256 amountAMin,
        uint256 amountBMin,
        address to,
        uint256 deadline
    ) public ensure(deadline) returns (uint256 amountA, uint256 amountB, uint256 liquidity) {
        (amountA, amountB) = _addLiquidity(
            tokenA,
            tokenB,
            stable,
            amountADesired,
            amountBDesired,
            amountAMin,
            amountBMin
        );
        address pool = poolFor(tokenA, tokenB, stable, defaultFactory);
        _safeTransferFrom(tokenA, msg.sender, pool, amountA);
        _safeTransferFrom(tokenB, msg.sender, pool, amountB);
        liquidity = IPool(pool).mint(to);
    }

    
    function addLiquidityETH(
        address token,
        bool stable,
        uint256 amountTokenDesired,
        uint256 amountTokenMin,
        uint256 amountETHMin,
        address to,
        uint256 deadline
    ) external payable ensure(deadline) returns (uint256 amountToken, uint256 amountETH, uint256 liquidity) {
        (amountToken, amountETH) = _addLiquidity(
            token,
            address(weth),
            stable,
            amountTokenDesired,
            msg.value,
            amountTokenMin,
            amountETHMin
        );
        address pool = poolFor(token, address(weth), stable, defaultFactory);
        _safeTransferFrom(token, msg.sender, pool, amountToken);
        weth.deposit{value: amountETH}();
        assert(weth.transfer(pool, amountETH));
        liquidity = IPool(pool).mint(to);
        // refund dust eth, if any
        if (msg.value > amountETH) _safeTransferETH(msg.sender, msg.value - amountETH);
    }

    // **** REMOVE LIQUIDITY ****

    
    function removeLiquidity(
        address tokenA,
        address tokenB,
        bool stable,
        uint256 liquidity,
        uint256 amountAMin,
        uint256 amountBMin,
        address to,
        uint256 deadline
    ) public ensure(deadline) returns (uint256 amountA, uint256 amountB) {
        address pool = poolFor(tokenA, tokenB, stable, defaultFactory);
        IERC20(pool).safeTransferFrom(msg.sender, pool, liquidity);
        (uint256 amount0, uint256 amount1) = IPool(pool).burn(to);
        (address token0, ) = sortTokens(tokenA, tokenB);
        (amountA, amountB) = tokenA == token0 ? (amount0, amount1) : (amount1, amount0);
        if (amountA < amountAMin) revert InsufficientAmountA();
        if (amountB < amountBMin) revert InsufficientAmountB();
    }

    
    function removeLiquidityETH(
        address token,
        bool stable,
        uint256 liquidity,
        uint256 amountTokenMin,
        uint256 amountETHMin,
        address to,
        uint256 deadline
    ) public ensure(deadline) returns (uint256 amountToken, uint256 amountETH) {
        (amountToken, amountETH) = removeLiquidity(
            token,
            address(weth),
            stable,
            liquidity,
            amountTokenMin,
            amountETHMin,
            address(this),
            deadline
        );
        _safeTransfer(token, to, amountToken);
        weth.withdraw(amountETH);
        _safeTransferETH(to, amountETH);
    }

    // **** REMOVE LIQUIDITY (supporting fee-on-transfer tokens) ****
    function removeLiquidityETHSupportingFeeOnTransferTokens(
        address token,
        bool stable,
        uint256 liquidity,
        uint256 amountTokenMin,
        uint256 amountETHMin,
        address to,
        uint256 deadline
    ) public ensure(deadline) returns (uint256 amountETH) {
        (, amountETH) = removeLiquidity(
            token,
            address(weth),
            stable,
            liquidity,
            amountTokenMin,
            amountETHMin,
            address(this),
            deadline
        );
        _safeTransfer(token, to, IERC20(token).balanceOf(address(this)));
        weth.withdraw(amountETH);
        _safeTransferETH(to, amountETH);
    }

    // **** SWAP ****
    /// @dev requires the initial amount to have already been sent to the first pool
    function _swap(uint256[] memory amounts, Route[] memory routes, address _to) internal virtual {
        uint256 _length = routes.length;
        for (uint256 i = 0; i < _length; i++) {
            (address token0, ) = sortTokens(routes[i].from, routes[i].to);
            uint256 amountOut = amounts[i + 1];
            (uint256 amount0Out, uint256 amount1Out) = routes[i].from == token0
                ? (uint256(0), amountOut)
                : (amountOut, uint256(0));
            address to = i < routes.length - 1
                ? poolFor(routes[i + 1].from, routes[i + 1].to, routes[i + 1].stable, routes[i + 1].factory)
                : _to;
            IPool(poolFor(routes[i].from, routes[i].to, routes[i].stable, routes[i].factory)).swap(
                amount0Out,
                amount1Out,
                to,
                new bytes(0)
            );
        }
    }

    function swapExactTokensForTokens(
        uint256 amountIn,
        uint256 amountOutMin,
        Route[] calldata routes,
        address to,
        uint256 deadline
    ) external ensure(deadline) returns (uint256[] memory amounts) {
        amounts = getAmountsOut(amountIn, routes);
        if (amounts[amounts.length - 1] < amountOutMin) revert InsufficientOutputAmount();
        _safeTransferFrom(
            routes[0].from,
            msg.sender,
            poolFor(routes[0].from, routes[0].to, routes[0].stable, routes[0].factory),
            amounts[0]
        );
        _swap(amounts, routes, to);
    }

    function swapExactETHForTokens(
        uint256 amountOutMin,
        Route[] calldata routes,
        address to,
        uint256 deadline
    ) external payable ensure(deadline) returns (uint256[] memory amounts) {
        if (routes[0].from != address(weth)) revert InvalidPath();
        amounts = getAmountsOut(msg.value, routes);
        if (amounts[amounts.length - 1] < amountOutMin) revert InsufficientOutputAmount();
        weth.deposit{value: amounts[0]}();
        assert(weth.transfer(poolFor(routes[0].from, routes[0].to, routes[0].stable, routes[0].factory), amounts[0]));
        _swap(amounts, routes, to);
    }

    function swapExactTokensForETH(
        uint256 amountIn,
        uint256 amountOutMin,
        Route[] calldata routes,
        address to,
        uint256 deadline
    ) external ensure(deadline) returns (uint256[] memory amounts) {
        if (routes[routes.length - 1].to != address(weth)) revert InvalidPath();
        amounts = getAmountsOut(amountIn, routes);
        if (amounts[amounts.length - 1] < amountOutMin) revert InsufficientOutputAmount();
        _safeTransferFrom(
            routes[0].from,
            msg.sender,
            poolFor(routes[0].from, routes[0].to, routes[0].stable, routes[0].factory),
            amounts[0]
        );
        _swap(amounts, routes, address(this));
        weth.withdraw(amounts[amounts.length - 1]);
        _safeTransferETH(to, amounts[amounts.length - 1]);
    }

    function UNSAFE_swapExactTokensForTokens(
        uint256[] memory amounts,
        Route[] calldata routes,
        address to,
        uint256 deadline
    ) external ensure(deadline) returns (uint256[] memory) {
        _safeTransferFrom(
            routes[0].from,
            msg.sender,
            poolFor(routes[0].from, routes[0].to, routes[0].stable, routes[0].factory),
            amounts[0]
        );
        _swap(amounts, routes, to);
        return amounts;
    }

    // **** SWAP (supporting fee-on-transfer tokens) ****
    /// @dev requires the initial amount to have already been sent to the first pool
    function _swapSupportingFeeOnTransferTokens(Route[] memory routes, address _to) internal virtual {
        uint256 _length = routes.length;
        for (uint256 i; i < _length; i++) {
            (address token0, ) = sortTokens(routes[i].from, routes[i].to);
            address pool = poolFor(routes[i].from, routes[i].to, routes[i].stable, routes[i].factory);
            uint256 amountInput;
            uint256 amountOutput;
            {
                // stack too deep
                (uint256 reserveA, ) = getReserves(routes[i].from, routes[i].to, routes[i].stable, routes[i].factory); // getReserves sorts it for us i.e. reserveA is always for from
                amountInput = IERC20(routes[i].from).balanceOf(pool) - reserveA;
            }
            amountOutput = IPool(pool).getAmountOut(amountInput, routes[i].from);
            (uint256 amount0Out, uint256 amount1Out) = routes[i].from == token0
                ? (uint256(0), amountOutput)
                : (amountOutput, uint256(0));
            address to = i < routes.length - 1
                ? poolFor(routes[i + 1].from, routes[i + 1].to, routes[i + 1].stable, routes[i + 1].factory)
                : _to;
            IPool(pool).swap(amount0Out, amount1Out, to, new bytes(0));
        }
    }

    
    function swapExactTokensForTokensSupportingFeeOnTransferTokens(
        uint256 amountIn,
        uint256 amountOutMin,
        Route[] calldata routes,
        address to,
        uint256 deadline
    ) external ensure(deadline) {
        _safeTransferFrom(
            routes[0].from,
            msg.sender,
            poolFor(routes[0].from, routes[0].to, routes[0].stable, routes[0].factory),
            amountIn
        );
        uint256 _length = routes.length - 1;
        uint256 balanceBefore = IERC20(routes[_length].to).balanceOf(to);
        _swapSupportingFeeOnTransferTokens(routes, to);
        if (IERC20(routes[_length].to).balanceOf(to) - balanceBefore < amountOutMin) revert InsufficientOutputAmount();
    }

    
    function swapExactETHForTokensSupportingFeeOnTransferTokens(
        uint256 amountOutMin,
        Route[] calldata routes,
        address to,
        uint256 deadline
    ) external payable ensure(deadline) {
        if (routes[0].from != address(weth)) revert InvalidPath();
        uint256 amountIn = msg.value;
        weth.deposit{value: amountIn}();
        assert(weth.transfer(poolFor(routes[0].from, routes[0].to, routes[0].stable, routes[0].factory), amountIn));
        uint256 _length = routes.length - 1;
        uint256 balanceBefore = IERC20(routes[_length].to).balanceOf(to);
        _swapSupportingFeeOnTransferTokens(routes, to);
        if (IERC20(routes[_length].to).balanceOf(to) - balanceBefore < amountOutMin) revert InsufficientOutputAmount();
    }

    
    function swapExactTokensForETHSupportingFeeOnTransferTokens(
        uint256 amountIn,
        uint256 amountOutMin,
        Route[] calldata routes,
        address to,
        uint256 deadline
    ) external ensure(deadline) {
        if (routes[routes.length - 1].to != address(weth)) revert InvalidPath();
        _safeTransferFrom(
            routes[0].from,
            msg.sender,
            poolFor(routes[0].from, routes[0].to, routes[0].stable, routes[0].factory),
            amountIn
        );
        _swapSupportingFeeOnTransferTokens(routes, address(this));
        uint256 amountOut = weth.balanceOf(address(this));
        if (amountOut < amountOutMin) revert InsufficientOutputAmount();
        weth.withdraw(amountOut);
        _safeTransferETH(to, amountOut);
    }


    /// @dev Return residual assets from zapping.
    /// @param token token to return, put `ETHER` if you want Ether back.
    function _returnAssets(address token) internal {
        address sender = msg.sender;
        uint256 balance;
        if (token == ETHER) {
            balance = IERC20(weth).balanceOf(address(this));
            if (balance > 0) {
                IWETH(weth).withdraw(balance);
                _safeTransferETH(sender, balance);
            }
        } else {
            balance = IERC20(token).balanceOf(address(this));
            if (balance > 0) {
                IERC20(token).safeTransfer(sender, balance);
            }
        }
    }

    
    function quoteStableLiquidityRatio(
        address tokenA,
        address tokenB,
        address _factory
    ) external view returns (uint256 ratio) {
        IPool pool = IPool(poolFor(tokenA, tokenB, true, _factory));

        uint256 decimalsA = 10 ** IERC20Metadata(tokenA).decimals();
        uint256 decimalsB = 10 ** IERC20Metadata(tokenB).decimals();

        uint256 investment = decimalsA;
        uint256 out = pool.getAmountOut(investment, tokenA);
        (uint256 amountA, uint256 amountB, ) = quoteAddLiquidity(tokenA, tokenB, true, _factory, investment, out);

        amountA = (amountA * 1e18) / decimalsA;
        amountB = (amountB * 1e18) / decimalsB;
        out = (out * 1e18) / decimalsB;
        investment = (investment * 1e18) / decimalsA;

        ratio = (((out * 1e18) / investment) * amountA) / amountB;

        return (investment * 1e18) / (ratio + 1e18);
    }

    function _safeTransferETH(address to, uint256 value) internal {
        (bool success, ) = to.call{value: value}(new bytes(0));
        if (!success) revert ETHTransferFailed();
    }

    function _safeTransfer(address token, address to, uint256 value) internal {
        require(token.code.length > 0);
        (bool success, bytes memory data) = token.call(abi.encodeWithSelector(IERC20.transfer.selector, to, value));
        require(success && (data.length == 0 || abi.decode(data, (bool))));
    }

    function _safeTransferFrom(address token, address from, address to, uint256 value) internal {
        require(token.code.length > 0);
        (bool success, bytes memory data) = token.call(
            abi.encodeWithSelector(IERC20.transferFrom.selector, from, to, value)
        );
        require(success && (data.length == 0 || abi.decode(data, (bool))));
    }
}
