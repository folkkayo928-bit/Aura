import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { CryptoNetwork } from '../../types';
import {
  X,
  ShieldCheck,
  CheckCircle2,
  Copy,
  Check,
  ExternalLink,
  ArrowUpRight,
  ArrowDownLeft,
  ArrowRightLeft,
  Building,
  Zap,
} from 'lucide-react';

interface UsdtAssetDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const UsdtAssetDetailsModal: React.FC<UsdtAssetDetailsModalProps> = ({ isOpen, onClose }) => {
  const { walletBalance, setSendModalOpen, setReceiveModalOpen, setP2pModalOpen } = useApp();
  const [selectedNetwork, setSelectedNetwork] = useState<CryptoNetwork>('polygon');
  const [copiedContract, setCopiedContract] = useState(false);

  if (!isOpen) return null;

  const usdtContracts: Record<CryptoNetwork, { address: string; standard: string; explorer: string }> = {
    ton: {
      address: 'EQCxE6mUtQKyTqGZhkBVNMTGEC56oWGMoB1GlqMpIph61Tr8',
      standard: 'Jetton (Official Telegram Tether)',
      explorer: 'https://tonviewer.com/EQCxE6mUtQKyTqGZhkBVNMTGEC56oWGMoB1GlqMpIph61Tr8',
    },
    polygon: {
      address: '0xc2132D05D31c914a87C6611C10748AEb04B58e8F',
      standard: 'ERC-20 / PoS',
      explorer: 'https://polygonscan.com/token/0xc2132d05d31c914a87c6611c10748aeb04b58e8f',
    },
    ethereum: {
      address: '0xdAC17F958D2ee523a2206206994597C13D831ec7',
      standard: 'ERC-20 (Mainnet)',
      explorer: 'https://etherscan.io/token/0xdac17f958d2ee523a2206206994597c13d831ec7',
    },
    arbitrum: {
      address: '0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9',
      standard: 'Arbitrum One',
      explorer: 'https://arbiscan.io/token/0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9',
    },
    bsc: {
      address: '0x55d398326f99059fF775485246999027B3197955',
      standard: 'BEP-20 · BNB Smart Chain',
      explorer: 'https://bscscan.com/token/0x55d398326f99059ff775485246999027b3197955',
    },
    solana: {
      address: 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB',
      standard: 'SPL Token',
      explorer: 'https://solscan.io/token/Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB',
    },
  };

  const currentContract = usdtContracts[selectedNetwork];

  const handleCopy = () => {
    navigator.clipboard?.writeText(currentContract.address);
    setCopiedContract(true);
    setTimeout(() => setCopiedContract(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/85 backdrop-blur-md p-0 sm:p-4">
      <div
        className="w-full max-w-md bg-[#111119] border border-white/10 rounded-t-3xl sm:rounded-3xl p-6 shadow-2xl animate-in slide-in-from-bottom-6 max-h-[92vh] overflow-y-auto no-scrollbar"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header with Tether Brand */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2.5">
            {/* Tether Emerald Seal */}
            <div className="w-8 h-8 rounded-full bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400 font-bold font-serif text-lg">
              ₮
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-bold text-stone-100 uppercase tracking-wider font-mono">
                  Tether USD (USDT)
                </span>
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
              </div>
              <span className="text-[10px] text-stone-400 font-mono block">
                USDT reference · 1 USDT targets 1 USD
              </span>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-stone-400 hover:text-stone-100"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Balance Card */}
        <div className="p-5 rounded-2xl bg-gradient-to-br from-[#16221c] via-[#101915] to-[#0c120f] border border-emerald-500/30 mb-5 relative overflow-hidden">
          <div className="flex items-center justify-between text-xs mb-1">
            <span className="text-emerald-300 font-mono text-[11px]">Vault USDT Holdings</span>
            <span className="text-emerald-400 font-mono text-[10px] bg-emerald-950/80 px-2 py-0.5 rounded-full border border-emerald-500/20">
              Pegged 1.00 USD
            </span>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="font-serif text-4xl text-stone-100 font-bold tabular-nums">
              ${walletBalance.toFixed(2)}
            </span>
            <span className="text-xs font-mono text-emerald-400 uppercase font-semibold">USDT</span>
          </div>

          <div className="flex items-center gap-2 pt-3 mt-3 border-t border-emerald-500/20 text-[11px] text-stone-300">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
            <span>Your displayed balance is an AURA platform-ledger balance. The token contracts below identify external USDT assets; they do not represent AURA proof-of-reserves.</span>
          </div>
        </div>

        {/* Quick USDT Actions */}
        <div className="grid grid-cols-3 gap-2 mb-5">
          <button
            onClick={() => {
              onClose();
              setSendModalOpen(true);
            }}
            className="p-3 rounded-xl bg-white/5 hover:bg-white/10 border border-white/5 flex flex-col items-center justify-center text-center transition-all group"
          >
            <ArrowUpRight className="w-4 h-4 text-stone-300 group-hover:text-amber-300 mb-1" />
            <span className="text-xs font-medium text-stone-200">Send USDT</span>
          </button>

          <button
            onClick={() => {
              onClose();
              setReceiveModalOpen(true);
            }}
            className="p-3 rounded-xl bg-white/5 hover:bg-white/10 border border-white/5 flex flex-col items-center justify-center text-center transition-all group"
          >
            <ArrowDownLeft className="w-4 h-4 text-stone-300 group-hover:text-cyan-300 mb-1" />
            <span className="text-xs font-medium text-stone-200">Receive USDT</span>
          </button>

          <button
            onClick={() => {
              onClose();
              setP2pModalOpen(true);
            }}
            className="p-3 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 flex flex-col items-center justify-center text-center transition-all group"
          >
            <ArrowRightLeft className="w-4 h-4 text-emerald-400 mb-1" />
            <span className="text-xs font-semibold text-emerald-300">Buy P2P</span>
          </button>
        </div>

        {/* Real Smart Contract Addresses across Blockchains */}
        <div className="space-y-3 p-4 rounded-2xl bg-[#0c0c12] border border-white/5 text-xs mb-4">
          <div className="flex items-center justify-between">
            <span className="font-mono text-stone-400 uppercase tracking-wider text-[11px]">
              Verified Token Contracts
            </span>
            <span className="text-emerald-400 font-mono text-[10px]">Real On-Chain</span>
          </div>

          {/* Network Switcher */}
          <div className="grid grid-cols-3 gap-1 p-1 bg-white/5 rounded-xl border border-white/5 font-mono text-[10px]">
            {(['ton', 'polygon', 'ethereum', 'arbitrum', 'bsc', 'solana'] as const).map((net) => (
              <button
                key={net}
                onClick={() => setSelectedNetwork(net)}
                className={`py-1.5 rounded-lg uppercase transition-all ${
                  selectedNetwork === net
                    ? 'bg-emerald-500 text-stone-950 font-bold'
                    : 'text-stone-400 hover:text-stone-200'
                }`}
              >
                {net === 'ton' ? 'TON' : net === 'polygon' ? 'Polygon' : net === 'ethereum' ? 'ETH' : net === 'arbitrum' ? 'Arbitrum' : net === 'bsc' ? 'BNB Chain' : 'Solana'}
              </button>
            ))}
          </div>

          <div className="space-y-1">
            <span className="text-[10px] text-stone-500 block font-mono">
              Standard: {currentContract.standard}
            </span>
            <div className="flex items-center justify-between p-2.5 rounded-xl bg-black/50 border border-white/10 font-mono text-[11px] text-stone-300">
              <span className="truncate mr-2">{currentContract.address}</span>
              <button
                onClick={handleCopy}
                className="text-stone-400 hover:text-emerald-400 transition-colors p-1"
                title="Copy token contract"
              >
                {copiedContract ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              </button>
            </div>
          </div>
        </div>

        {/* Wallet Security Flow */}
        <div className="flex items-start gap-2.5 p-3.5 rounded-2xl bg-white/[0.02] border border-white/5 text-xs text-stone-400 leading-relaxed mb-5">
          <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
          <span>
            Your AURA balance is maintained in the platform ledger. When you withdraw, AURA reserves the requested amount first and only broadcasts after the security confirmation flow succeeds.
          </span>
        </div>

        <button
          onClick={onClose}
          className="w-full py-3.5 rounded-xl bg-stone-100 hover:bg-white text-stone-950 font-bold text-xs transition-colors"
        >
          Done
        </button>
      </div>
    </div>
  );
};
