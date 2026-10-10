import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { supabase } from '../../lib/supabase';
import { ArtworkCanvas } from '../ArtworkCanvas';
import { AURA_ASSETS, AURA_WITHDRAWAL_NETWORKS } from '../../config/crypto';
import { UsdtAssetDetailsModal } from '../usdt/UsdtAssetDetailsModal';
import { TransactionHistoryModal } from '../wallet/TransactionHistoryModal';

const formatExactUsdtBalance = (value: number): string => {
  if (!Number.isFinite(value)) return '0';
  return value.toFixed(8).replace(/\.?0+$/, '');
};

import {
  Send,
  QrCode,
  PlusCircle,
  ArrowRightLeft,
  ShieldCheck,
  TrendingUp,
  Clock,
  Sparkles,
  ChevronRight,
  Link,
  Zap,
  ArrowUpDown,
  Lock,
  BadgeCheck,
  History,
  RefreshCw,
  ExternalLink,
} from 'lucide-react';

export const WalletView: React.FC = () => {
  const {
    walletBalance,
    artworks,
    transactions,
    setSendModalOpen,
    setReceiveModalOpen,
    setBuyModalOpen,
    setConvertModalArtwork,
    setSelectedArtwork,
    setP2pModalOpen,
    connectedWallets,
    setSettingsModalOpen,
    activeP2POrder,
    userProfile,
    requestWalletWithdrawal,
    connectExternalWallet,
  } = useApp();




  const ownedArtworks = artworks.filter((a) => a.isOwned);
  const digitalArtValuation = ownedArtworks.reduce((acc, a) => acc + a.currentValue, 0);
  const totalNetWorth = walletBalance + digitalArtValuation;

  const [usdtDetailsOpen, setUsdtDetailsOpen] = useState(false);
  const [withdrawOpen, setWithdrawOpen] = useState(false);
  const [withdrawAsset, setWithdrawAsset] = useState<'USDT'>('USDT');
  const [withdrawChain, setWithdrawChain] = useState<'polygon' | 'ethereum' | 'arbitrum'>('polygon');
  const [withdrawAddress, setWithdrawAddress] = useState('');
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [withdrawBusy, setWithdrawBusy] = useState(false);
  const [withdrawMessage, setWithdrawMessage] = useState('');
  const [historyOpen, setHistoryOpen] = useState(false);
  const [withdrawalHistoryOpen, setWithdrawalHistoryOpen] = useState(false);
  const [withdrawalHistory, setWithdrawalHistory] = useState<any[]>([]);
  const [withdrawalHistoryBusy, setWithdrawalHistoryBusy] = useState(false);
  const [withdrawalHistoryError, setWithdrawalHistoryError] = useState('');

  const openWithdrawalHistory = async () => {
    setWithdrawalHistoryOpen(true);
    setWithdrawalHistoryBusy(true);
    setWithdrawalHistoryError('');
    try {
      const { data, error } = await supabase.rpc('my_withdrawal_history_v2', { p_limit: 100 });
      if (error) {
        setWithdrawalHistoryError('Could not load withdrawal history. Please refresh and try again.');
        return;
      }
      setWithdrawalHistory(data || []);
    } catch {
      setWithdrawalHistoryError('Connection problem while loading withdrawal history. Please try again.');
    } finally {
      setWithdrawalHistoryBusy(false);
    }
  };


  return (
    <div className="space-y-6 pb-24">
      {/* WALLET HERO: TOTAL VALUE CARD */}
      <div className="pt-2 px-1">
        <div className="p-6 rounded-3xl bg-gradient-to-b from-[#161622] to-[#0f0f17] border border-white/10 shadow-2xl relative overflow-hidden">
          <div className="flex items-center justify-between text-xs mb-2">
            <span className="font-mono text-stone-300 uppercase tracking-widest flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
              AURA Internal Vault
            </span>
            <span className="text-emerald-400 font-mono text-[11px] flex items-center gap-1">
              <TrendingUp className="w-3 h-3" />
              Wallet Balance
            </span>
          </div>

          <div className="space-y-1 mb-5">
            <span className="text-xs text-stone-400 block">Total Portfolio Value</span>
            <div className="flex items-baseline gap-2">
              <span className="font-serif text-4xl sm:text-5xl text-stone-100 font-light tracking-tight tabular-nums">
                ${totalNetWorth.toFixed(2)}
              </span>
              <span className="text-xs font-mono text-emerald-400 uppercase font-semibold">USDT</span>
            </div>
          </div>

          {/* 2-Column Split: Crypto vs Digital Art */}
          <div className="grid grid-cols-2 gap-3 pt-3 border-t border-white/5">
            <div
              onClick={() => setUsdtDetailsOpen(true)}
              className="p-3 rounded-2xl bg-emerald-950/20 border border-emerald-500/20 hover:border-emerald-500/40 cursor-pointer transition-all"
            >
              <div className="flex items-center justify-between text-[11px] text-emerald-300 mb-0.5">
                <span>USDT Balance</span>
                <span className="text-[10px] text-emerald-400 font-mono">₮ 1:1 USD</span>
              </div>
              <span className="font-serif text-lg font-bold text-stone-100 tabular-nums">
                ${formatExactUsdtBalance(walletBalance)}
              </span>
              <span className="text-[10px] text-stone-400 font-mono block mt-0.5">
                Tap for Token Contracts →
              </span>
            </div>

            <div className="p-3 rounded-2xl bg-white/[0.03] border border-white/5">
              <span className="text-[11px] text-stone-400 block mb-0.5">Digital Art Valuation</span>
              <span className="font-serif text-lg font-medium text-amber-300 tabular-nums">
                ${digitalArtValuation.toFixed(2)}
              </span>
              <span className="text-[10px] text-stone-500 font-mono block mt-0.5">
                {ownedArtworks.length} Masterpieces
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* PRIMARY ASSET: TETHER USD (USDT) BANNER */}
      <div className="px-1">
        <div
          onClick={() => setUsdtDetailsOpen(true)}
          className="p-4 rounded-3xl bg-gradient-to-r from-[#0d1f17] via-[#111915] to-[#0f121b] border border-emerald-500/30 hover:border-emerald-500/60 cursor-pointer transition-all shadow-md flex items-center justify-between group"
        >
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 flex items-center justify-center font-serif text-2xl font-bold shrink-0">
              ₮
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-bold text-stone-100 uppercase tracking-wide font-mono">
                  Tether USD (USDT)
                </span>
                <BadgeCheck className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
              </div>
              <p className="text-[11px] text-stone-400 mt-0.5">
                Polygon · Ethereum · Arbitrum
              </p>
            </div>
          </div>

          <div className="text-right">
            <span className="font-serif text-base font-bold text-stone-100 tabular-nums block">
              ${formatExactUsdtBalance(walletBalance)}
            </span>
            <span className="text-[10px] text-emerald-400 font-mono">Details →</span>
          </div>
        </div>
      </div>

      {/* 4 PRIMARY ACTION BUTTONS: Send / Receive / Buy / Convert */}
      <div className="grid grid-cols-4 gap-2 px-1">
        <button
          onClick={() => setSendModalOpen(true)}
          className="p-3 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/5 flex flex-col items-center justify-center transition-all group active:scale-95 min-h-[64px]"
        >
          <div className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center text-stone-300 group-hover:text-amber-300 transition-colors mb-1">
            <Send className="w-4 h-4" />
          </div>
          <span className="text-xs font-medium text-stone-300">Send</span>
        </button>

        <button
          onClick={() => setReceiveModalOpen(true)}
          className="p-3 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/5 flex flex-col items-center justify-center transition-all group active:scale-95 min-h-[64px]"
        >
          <div className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center text-stone-300 group-hover:text-cyan-300 transition-colors mb-1">
            <QrCode className="w-4 h-4" />
          </div>
          <span className="text-xs font-medium text-stone-300">Receive</span>
        </button>

        <button
          onClick={() => setBuyModalOpen(true)}
          className="p-3 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/5 flex flex-col items-center justify-center transition-all group active:scale-95 min-h-[64px]"
        >
          <div className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center text-stone-300 group-hover:text-emerald-300 transition-colors mb-1">
            <PlusCircle className="w-4 h-4" />
          </div>
          <span className="text-xs font-medium text-stone-300">Buy</span>
        </button>

        <button
          onClick={() => {
            if (ownedArtworks.length > 0) {
              setConvertModalArtwork(ownedArtworks[0]);
            }
          }}
          className="p-3 rounded-2xl bg-gradient-to-b from-amber-400/20 to-amber-500/10 hover:from-amber-400/30 hover:to-amber-500/20 border border-amber-400/30 flex flex-col items-center justify-center transition-all group active:scale-95 min-h-[64px]"
        >
          <div className="w-10 h-10 rounded-full bg-amber-400/20 flex items-center justify-center text-amber-300 mb-1">
            <ArrowRightLeft className="w-4 h-4" />
          </div>
          <span className="text-xs font-semibold text-amber-200">Convert</span>
        </button>
      </div>

      {/* SECURE WITHDRAWAL */}
      <div className="px-1">
        <button
          onClick={() => { setWithdrawMessage(''); setWithdrawOpen(true); }}
          className="w-full p-4 rounded-3xl bg-white/[0.03] border border-white/10 hover:border-amber-400/40 transition-all flex items-center justify-between"
        >
          <div className="flex items-center gap-3 text-left">
            <div className="w-10 h-10 rounded-2xl bg-amber-400/10 text-amber-300 flex items-center justify-center">
              <Send className="w-4 h-4" />
            </div>
            <div>
              <div className="text-sm font-semibold text-stone-100">Withdraw USDT</div>
              <div className="text-[11px] text-stone-400">Secure request · confirm via Telegram or email</div>
            </div>
          </div>
          <ChevronRight className="w-5 h-5 text-stone-500" />
        </button>
      </div>

      {/* AURA PROTECTED P2P ESCROW BANNER */}
      <div className="px-1">
        <div
          onClick={() => setP2pModalOpen(true)}
          className="p-4 rounded-3xl bg-gradient-to-r from-emerald-500/10 via-[#181824] to-amber-500/10 border border-emerald-500/30 hover:border-emerald-500/60 transition-all cursor-pointer shadow-lg group relative overflow-hidden"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 flex items-center justify-center shrink-0">
                <ArrowUpDown className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-stone-100">
                    AURA P2P Trade Hold
                  </span>
                  <span className="text-[10px] font-mono text-emerald-400 bg-emerald-950/80 px-2 py-0.5 rounded-full border border-emerald-500/30">
                    Internal Hold
                  </span>
                </div>
                <p className="text-[11px] text-stone-400 mt-0.5">
                  Trade with other AURA accounts using the payment instructions in each live offer.
                </p>
              </div>
            </div>
            <ChevronRight className="w-5 h-5 text-stone-400 group-hover:text-emerald-300 group-hover:translate-x-1 transition-all shrink-0" />
          </div>

          {activeP2POrder && (
            <div className="mt-3 pt-2.5 border-t border-white/5 flex items-center justify-between text-xs">
              <span className="text-emerald-300 font-semibold flex items-center gap-1.5 animate-pulse">
                <Lock className="w-3.5 h-3.5" /> Internal Hold: {activeP2POrder.cryptoAmount} USDT
              </span>
              <span className="text-stone-400 font-mono text-[11px]">View Order →</span>
            </div>
          )}
        </div>
      </div>

      {/* AURA INTERNAL VAULT */}
      <div className="space-y-3 px-1">
        <div className="flex items-center justify-between text-xs">
          <span className="font-mono text-stone-300 uppercase tracking-widest flex items-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5 text-cyan-400" />
            AURA Internal Vault
          </span>
          <span className="text-stone-500 font-mono text-[10px]">Account-linked</span>
        </div>
        <div className="p-4 rounded-3xl bg-[#111118] border border-white/5 space-y-3">
          <div>
            <span className="text-[10px] text-stone-500 block uppercase mb-1">Your Vault ID</span>
            <div className="flex items-center justify-between gap-2 p-3 rounded-2xl bg-black/30 border border-white/10">
              <span className="font-mono text-xs text-cyan-300 truncate">{userProfile.vaultId}</span>
              <button
                onClick={() => navigator.clipboard?.writeText(userProfile.vaultId)}
                className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-stone-400 hover:text-cyan-300"
                title="Copy Vault ID"
              >
                <Link className="w-4 h-4" />
              </button>
            </div>
          </div>
          <p className="text-[11px] text-stone-400 leading-relaxed">
            Use this Vault ID or your AURA handle to receive internal USDT from another AURA account. External blockchain deposits require a connected wallet/provider and are not simulated by AURA.
          </p>
          <button onClick={() => setReceiveModalOpen(true)} className="w-full py-3 rounded-xl bg-cyan-400/10 border border-cyan-400/20 text-cyan-300 font-semibold text-xs">
            Show Receive Details
          </button>
        </div>
      </div>

      {/* LINKED EXTERNAL WALLETS */}
      <div className="space-y-3 px-1">
        <div className="flex items-center justify-between text-xs">
          <span className="font-mono text-stone-300 uppercase tracking-widest flex items-center gap-1.5">
            <Link className="w-3.5 h-3.5 text-amber-400" />
            Connected Web3 Platforms
          </span>
          <button
            onClick={() => setSettingsModalOpen(true)}
            className="text-amber-300 font-mono text-[11px] hover:underline"
          >
            Manage Wallets →
          </button>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={() => connectExternalWallet('MetaMask', 'polygon')}
            className="rounded-2xl border border-amber-400/20 bg-amber-400/[0.05] p-3 text-left hover:bg-amber-400/10 transition-colors"
          >
            <div className="text-xs font-semibold text-stone-100">MetaMask</div>
            <div className="mt-1 text-[10px] font-mono text-amber-300">Polygon / EVM</div>
            <div className="mt-2 text-[10px] text-stone-500">Connect or open MetaMask</div>
          </button>
          <button
            onClick={() => connectExternalWallet('Phantom', 'solana')}
            className="rounded-2xl border border-purple-400/20 bg-purple-400/[0.05] p-3 text-left hover:bg-purple-400/10 transition-colors"
          >
            <div className="text-xs font-semibold text-stone-100">Phantom</div>
            <div className="mt-1 text-[10px] font-mono text-purple-300">Solana</div>
            <div className="mt-2 text-[10px] text-stone-500">Connect or open Phantom</div>
          </button>
        </div>

        <div className="space-y-2">
          {connectedWallets.length === 0 ? (
            <div className="p-3.5 rounded-2xl bg-white/[0.02] border border-white/5 text-xs text-stone-500 text-center">
              No external wallet connected. Use MetaMask or Phantom above, or manage verified wallets in Settings.
            </div>
          ) : (
            connectedWallets.map((w) => (
              <div
                key={w.id}
                className="p-3.5 rounded-2xl bg-white/[0.02] border border-white/5 flex items-center justify-between text-xs"
              >
                <div className="flex items-center gap-2.5">
                  <div className="w-7 h-7 rounded-full bg-white/5 flex items-center justify-center text-amber-300 border border-white/10">
                    <Zap className="w-3.5 h-3.5" />
                  </div>
                  <div>
                    <span className="font-semibold text-stone-200">{w.name}</span>
                    <span className="text-[10px] text-stone-500 font-mono block">
                      {w.address}
                    </span>
                  </div>
                </div>

                <div className="text-right font-mono">
                  <span className="text-emerald-400 font-medium">{w.balance > 0 ? `${w.balance} USDT` : 'Balance unavailable'}</span>
                  <span className="text-[10px] text-stone-500 block uppercase">{w.network}</span>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* External wallet connections are managed above and in Settings. */}
      {/* CONVERT QUICK ACCESS STRIP */}
      {ownedArtworks.length > 0 && (
        <div className="space-y-3 px-1">
          <div className="flex items-center justify-between text-xs">
            <span className="font-mono text-stone-300 uppercase tracking-widest flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              Convertible Masterpieces
            </span>
            <span className="text-stone-400 font-mono text-[11px]">Instant Liquidity</span>
          </div>

          <div className="space-y-2">
            {ownedArtworks.map((art) => {
              const estimatedPayout = Math.max(0, art.currentValue - 2);
              return (
                <div
                  key={art.id}
                  className="p-3 rounded-2xl bg-white/[0.03] border border-white/5 flex items-center justify-between hover:border-white/15 transition-all"
                >
                  <div
                    onClick={() => setSelectedArtwork(art)}
                    className="flex items-center gap-3 cursor-pointer min-w-0"
                  >
                    <div className="w-12 h-14 rounded-xl overflow-hidden shrink-0 border border-white/10">
                      <ArtworkCanvas artwork={art} showOverlayGrain={false} />
                    </div>
                    <div className="min-w-0">
                      <h4 className="font-serif text-sm text-stone-100 truncate">
                        {art.title}
                      </h4>
                      <p className="text-[11px] text-stone-400 font-mono">
                        Value: ${art.currentValue} · Fee: $2
                      </p>
                    </div>
                  </div>

                  <button
                    onClick={() => setConvertModalArtwork(art)}
                    className="px-3 py-1.5 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 text-emerald-300 font-medium text-xs flex items-center gap-1 transition-colors shrink-0"
                  >
                    <span>Get ${estimatedPayout}</span>
                    <ChevronRight className="w-3 h-3" />
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="px-1">
        <button
          onClick={() => setHistoryOpen(true)}
          className="w-full p-3.5 rounded-2xl bg-white/[0.03] border border-white/10 hover:border-cyan-400/30 transition-all flex items-center justify-between"
        >
          <div className="text-left">
            <div className="text-xs font-semibold text-stone-100">Full transaction history</div>
            <div className="text-[10px] text-stone-500 mt-0.5">Deposits · withdrawals · AURA ledger · blockchain hashes</div>
          </div>
          <ChevronRight className="w-4 h-4 text-stone-500" />
        </button>
      </div>

      <div className="px-1">
        <button
          onClick={() => void openWithdrawalHistory()}
          className="w-full p-3.5 rounded-2xl bg-white/[0.02] border border-white/10 hover:border-amber-400/30 transition-all flex items-center justify-between"
        >
          <div className="flex items-center gap-3 text-left">
            <History className="w-4 h-4 text-amber-300" />
            <div>
              <div className="text-xs font-semibold text-stone-100">Withdrawal history</div>
              <div className="text-[10px] text-stone-500 mt-0.5">Requests · confirmations · blockchain status</div>
            </div>
          </div>
          <ChevronRight className="w-4 h-4 text-stone-500" />
        </button>
      </div>

      {/* RECENT VAULT ACTIVITY (With on-chain tags) */}
      <div className="space-y-3 px-1">
        <div className="flex items-center justify-between text-xs">
          <span className="font-mono text-stone-300 uppercase tracking-widest flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5 text-stone-400" />
            Ledger & On-Chain Activity
          </span>
          <span className="text-stone-400 font-mono text-[11px]">Cross-Chain Sync</span>
        </div>

        <div className="space-y-2">
          {transactions.map((tx) => (
            <div
              key={tx.id}
              className="p-3.5 rounded-2xl bg-white/[0.02] border border-white/5 flex items-center justify-between text-xs"
            >
              <div className="flex items-center gap-3">
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
                    tx.type === 'collect'
                      ? 'bg-amber-400/10 text-amber-300'
                      : tx.type === 'convert'
                      ? 'bg-emerald-400/10 text-emerald-300'
                      : tx.type === 'receive'
                      ? 'bg-cyan-400/10 text-cyan-300'
                      : tx.type === 'p2p_buy' || tx.type === 'p2p_sell'
                      ? 'bg-purple-400/10 text-purple-300'
                      : 'bg-rose-400/10 text-rose-300'
                  }`}
                >
                  {tx.type === 'collect' && <Sparkles className="w-4 h-4" />}
                  {tx.type === 'convert' && <ArrowRightLeft className="w-4 h-4" />}
                  {tx.type === 'receive' && <PlusCircle className="w-4 h-4" />}
                  {tx.type === 'send' && <Send className="w-4 h-4" />}
                  {(tx.type === 'p2p_buy' || tx.type === 'p2p_sell') && <ArrowUpDown className="w-4 h-4" />}
                  {tx.type === 'create' && <Sparkles className="w-4 h-4" />}
                </div>

                <div>
                  <div className="font-medium text-stone-200 truncate max-w-[180px]">
                    {tx.type === 'collect' && `Collected ${tx.artworkTitle}`}
                    {tx.type === 'convert' && `Converted ${tx.artworkTitle}`}
                    {tx.type === 'receive' && (tx.isExternal ? 'External Web3 Deposit' : 'Deposit Received')}
                    {tx.type === 'send' && (tx.isExternal ? `Sent to ${tx.recipientOrSender}` : `Sent to ${tx.recipientOrSender}`)}
                    {tx.type === 'p2p_buy' && `P2P Buy (${tx.recipientOrSender})`}
                    {tx.type === 'p2p_sell' && `P2P Sell (${tx.recipientOrSender})`}
                    {tx.type === 'create' && `Minted ${tx.artworkTitle}`}
                  </div>
                  <div className="flex items-center gap-2 text-[10px] text-stone-500 font-mono mt-0.5">
                    <span>{tx.date}</span>
                    {tx.network && (
                      <>
                        <span>·</span>
                        <span className="text-cyan-300 uppercase">{tx.network}</span>
                      </>
                    )}
                    {tx.txHash && (
                      <>
                        <span>·</span>
                        <span className="text-stone-400 truncate max-w-[80px]">{tx.txHash}</span>
                      </>
                    )}
                  </div>
                </div>
              </div>

              <div className="text-right">
                <span
                  className={`font-mono font-medium block tabular-nums ${
                    tx.type === 'convert' || tx.type === 'receive' || tx.type === 'p2p_buy'
                      ? 'text-emerald-400'
                      : 'text-stone-300'
                  }`}
                >
                  {tx.type === 'convert' || tx.type === 'receive' || tx.type === 'p2p_buy' ? '+' : '-'}${tx.amount}{' '}
                  <span className="text-[10px] text-stone-400">{tx.currency}</span>
                </span>
                <span className="text-[10px] text-stone-500 uppercase font-mono">
                  {tx.status}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {withdrawOpen && (
        <div className="fixed inset-0 z-[80] bg-black/70 backdrop-blur-sm flex items-end sm:items-center justify-center p-3">
          <div className="w-full max-w-md rounded-3xl bg-[#111118] border border-white/10 p-5 shadow-2xl">
            <div className="flex items-center justify-between mb-5">
              <div>
                <h3 className="text-lg font-semibold text-stone-100">Withdraw USDT</h3>
                <p className="text-[11px] text-stone-400 mt-1">Funds are reserved until you confirm through Telegram or email. If you enabled Google Authenticator, AURA will also require your current 6-digit authenticator code before the request can continue.</p>
              </div>
              <button onClick={() => setWithdrawOpen(false)} className="text-stone-400 text-sm">Close</button>
            </div>
            <div className="space-y-3">
              <label className="block text-xs text-stone-400">Asset
                <select value={withdrawAsset} onChange={e => setWithdrawAsset(e.target.value as 'USDT')} className="mt-1 w-full rounded-2xl bg-white/5 border border-white/10 p-3 text-stone-100">
                  {AURA_ASSETS.map((asset) => (
                    <option key={asset.id} value={asset.id}>{asset.label}</option>
                  ))}
                </select>
              </label>
              <label className="block text-xs text-stone-400">Network
                <select value={withdrawChain} onChange={e => setWithdrawChain(e.target.value as typeof withdrawChain)} className="mt-1 w-full rounded-2xl bg-white/5 border border-white/10 p-3 text-stone-100">
                  {AURA_WITHDRAWAL_NETWORKS.map((network) => (
                    <option key={network.id} value={network.id}>{network.label} · {network.tokenSymbol}</option>
                  ))}
                </select>
                <span className="text-[10px] text-stone-500 mt-1 block">
                  Real withdrawals currently support USDT on these three networks. Other chains/assets are kept out of the form until their secure ledger and broadcaster support is ready.
                </span>
              </label>
              <label className="block text-xs text-stone-400">Destination address
                <input value={withdrawAddress} onChange={e => setWithdrawAddress(e.target.value)} placeholder="Paste the destination wallet address" className="mt-1 w-full rounded-2xl bg-white/5 border border-white/10 p-3 text-stone-100 placeholder:text-stone-600" />
              </label>
              <label className="block text-xs text-stone-400">Amount (USDT)
                <input type="number" min="0" step="0.01" value={withdrawAmount} onChange={e => setWithdrawAmount(e.target.value)} placeholder="0.00" className="mt-1 w-full rounded-2xl bg-white/5 border border-white/10 p-3 text-stone-100 placeholder:text-stone-600" />
              </label>
              <button
                disabled={withdrawBusy}
                onClick={async () => {
                  const amount = Number(withdrawAmount);
                  if (!withdrawAddress.trim() || !Number.isFinite(amount) || amount <= 0) {
                    setWithdrawMessage('Enter a valid destination address and amount.');
                    return;
                  }
                  if (amount > walletBalance) {
                    setWithdrawMessage('Amount exceeds your available AURA balance.');
                    return;
                  }
                  setWithdrawBusy(true);
                  const result = await requestWalletWithdrawal({
                    chain: withdrawChain,
                    destinationAddress: withdrawAddress.trim(),
                    amount,
                  });
                  setWithdrawBusy(false);
                  if (!result.success) {
                    setWithdrawMessage(result.error || 'Withdrawal request failed.');
                    return;
                  }
                  setWithdrawMessage('Request created. Your balance is reserved. Check your email to confirm; if Authenticator is enabled, complete the 6-digit step-up first.');
                  setWithdrawAmount('');
                  setWithdrawAddress('');
                }}
                className="w-full rounded-2xl bg-amber-400 text-black font-semibold py-3 disabled:opacity-50"
              >
                {withdrawBusy ? 'Securing request…' : 'Request withdrawal'}
              </button>
              {withdrawMessage && <p className="text-xs text-stone-300">{withdrawMessage}</p>}
            </div>
          </div>
        </div>
      )}

      <TransactionHistoryModal open={historyOpen} onClose={() => setHistoryOpen(false)} />

      {withdrawalHistoryOpen && (
        <div className="fixed inset-0 z-[90] bg-black/75 backdrop-blur-sm flex items-end sm:items-center justify-center p-3">
          <div className="w-full max-w-md max-h-[82vh] overflow-hidden rounded-3xl bg-[#111118] border border-white/10 shadow-2xl flex flex-col">
            <div className="p-5 border-b border-white/10 flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold text-stone-100">Withdrawal history</h3>
                <p className="text-[10px] text-stone-500 mt-1">Only requests belonging to your AURA account are shown.</p>
              </div>
              <div className="flex items-center gap-2">
                <button type="button" onClick={() => void openWithdrawalHistory()} disabled={withdrawalHistoryBusy} className="flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-white/[0.04] text-stone-400 disabled:opacity-40" aria-label="Refresh withdrawal history">
                  <RefreshCw className={'h-3.5 w-3.5 ' + (withdrawalHistoryBusy ? 'animate-spin' : '')} />
                </button>
                <button onClick={() => setWithdrawalHistoryOpen(false)} className="text-stone-400 text-sm">Close</button>
              </div>
            </div>
            <div className="overflow-y-auto p-4 space-y-2">
              {withdrawalHistoryBusy && <div className="py-8 text-center text-xs text-stone-500">Loading withdrawal history…</div>}
              {withdrawalHistoryError && <div className="rounded-xl border border-rose-400/20 bg-rose-400/[0.04] p-3 text-xs text-rose-300">{withdrawalHistoryError}</div>}
              {!withdrawalHistoryBusy && !withdrawalHistoryError && withdrawalHistory.length === 0 && <div className="py-8 text-center text-xs text-stone-500">No withdrawal requests yet.</div>}
              {!withdrawalHistoryBusy && withdrawalHistory.map((w) => {
                const explorerBase: Record<string, string> = { ethereum: 'https://etherscan.io/tx/', polygon: 'https://polygonscan.com/tx/', arbitrum: 'https://arbiscan.io/tx/', bsc: 'https://bscscan.com/tx/' };
                const explorer = w.tx_hash && explorerBase[String(w.chain || '').toLowerCase()] ? explorerBase[String(w.chain).toLowerCase()] + w.tx_hash : null;
                return (
                  <div key={w.id} className="rounded-2xl border border-white/10 bg-white/[.02] p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="font-mono text-sm text-stone-100">{Number(w.amount || 0).toFixed(6)} {w.token_symbol || 'USDT'}</div>
                        <div className="mt-1 text-[10px] text-stone-500">Network fee: {Number(w.network_fee || 0).toFixed(6)} USDT · Total reserved: {(Number(w.amount || 0) + Number(w.network_fee || 0)).toFixed(6)} USDT</div>
                        <div className="mt-1 text-[10px] uppercase tracking-wider text-stone-500">{w.chain} · {String(w.status || '').replaceAll('_', ' ')}</div>
                      </div>
                      <div className="text-right text-[9px] text-stone-600">{w.created_at ? new Date(w.created_at).toLocaleString() : ''}</div>
                    </div>
                    <div className="mt-3 text-[10px] text-stone-500 break-all">{w.destination_address}</div>
                    <div className="mt-3 space-y-1 text-[10px] text-stone-500">
                      <div>Confirmation: <span className="text-stone-300">{w.email_confirmed_at ? new Date(w.email_confirmed_at).toLocaleString() : 'Not confirmed yet'}</span></div>
                      <div>Blockchain broadcast: <span className="text-stone-300">{w.broadcast_at ? new Date(w.broadcast_at).toLocaleString() : 'Not broadcast yet'}</span></div>
                      <div>On-chain confirmation: <span className="text-stone-300">{w.confirmed_onchain_at ? new Date(w.confirmed_onchain_at).toLocaleString() : 'Awaiting confirmation'}</span></div>
                    </div>
                    {w.tx_hash && <div className="mt-2 flex flex-wrap items-center gap-2 text-[10px] text-cyan-300 break-all"><span>Tx: {w.tx_hash}</span>{explorer && <a href={explorer} target="_blank" rel="noreferrer" className="inline-flex shrink-0 items-center gap-1 text-amber-300">Explorer <ExternalLink className="h-3 w-3" /></a>}</div>}
                    {w.rejection_reason && <div className="mt-2 text-[10px] text-rose-300">Reason: {w.rejection_reason}</div>}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Tether USDT Token Details Modal */}
      <UsdtAssetDetailsModal
        isOpen={usdtDetailsOpen}
        onClose={() => setUsdtDetailsOpen(false)}
      />
    </div>
  );
};
