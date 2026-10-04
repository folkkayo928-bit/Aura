import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { CryptoNetwork } from '../../types';
import { ArtworkCanvas } from '../ArtworkCanvas';
import { UsdtAssetDetailsModal } from '../usdt/UsdtAssetDetailsModal';
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
  Globe,
  Link,
  Copy,
  Check,
  Zap,
  ArrowUpDown,
  Lock,
  BadgeCheck,
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
    vaultAddresses,
    connectedWallets,
    setSettingsModalOpen,
    activeP2POrder,
  } = useApp();

  const [activeNetworkView, setActiveNetworkView] = useState<CryptoNetwork>('ton');
  const [copiedAddr, setCopiedAddr] = useState(false);
  const [usdtDetailsOpen, setUsdtDetailsOpen] = useState(false);

  const ownedArtworks = artworks.filter((a) => a.isOwned);
  const digitalArtValuation = ownedArtworks.reduce((acc, a) => acc + a.currentValue, 0);
  const totalNetWorth = walletBalance + digitalArtValuation;

  const currentAddress =
    activeNetworkView === 'ton'
      ? vaultAddresses.ton
      : activeNetworkView === 'solana'
      ? vaultAddresses.solana
      : vaultAddresses.polygon;

  const handleCopy = () => {
    navigator.clipboard?.writeText(currentAddress);
    setCopiedAddr(true);
    setTimeout(() => setCopiedAddr(false), 2000);
  };

  return (
    <div className="space-y-6 pb-24">
      {/* WALLET HERO: TOTAL VALUE CARD */}
      <div className="pt-2 px-1">
        <div className="p-6 rounded-3xl bg-gradient-to-b from-[#161622] to-[#0f0f17] border border-white/10 shadow-2xl relative overflow-hidden">
          <div className="flex items-center justify-between text-xs mb-2">
            <span className="font-mono text-stone-300 uppercase tracking-widest flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
              Multi-Chain Web3 Vault
            </span>
            <span className="text-emerald-400 font-mono text-[11px] flex items-center gap-1">
              <TrendingUp className="w-3 h-3" />
              Live Net
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
                ${walletBalance.toFixed(2)}
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
                TON (Jetton) · Polygon · Ethereum · Arbitrum · Solana
              </p>
            </div>
          </div>

          <div className="text-right">
            <span className="font-serif text-base font-bold text-stone-100 tabular-nums block">
              ${walletBalance.toFixed(2)}
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
                    Protected P2P Escrow
                  </span>
                  <span className="text-[10px] font-mono text-emerald-400 bg-emerald-950/80 px-2 py-0.5 rounded-full border border-emerald-500/30">
                    100% Guaranteed
                  </span>
                </div>
                <p className="text-[11px] text-stone-400 mt-0.5">
                  Exchange USDT with verified legal peers via Revolut, Bank Wire, Wise, or Telegram Wallet.
                </p>
              </div>
            </div>
            <ChevronRight className="w-5 h-5 text-stone-400 group-hover:text-emerald-300 group-hover:translate-x-1 transition-all shrink-0" />
          </div>

          {activeP2POrder && (
            <div className="mt-3 pt-2.5 border-t border-white/5 flex items-center justify-between text-xs">
              <span className="text-emerald-300 font-semibold flex items-center gap-1.5 animate-pulse">
                <Lock className="w-3.5 h-3.5" /> Escrow Protected: {activeP2POrder.cryptoAmount} USDT
              </span>
              <span className="text-stone-400 font-mono text-[11px]">View Order →</span>
            </div>
          )}
        </div>
      </div>

      {/* REAL MULTI-CHAIN WEB3 ADDRESS STRIP */}
      <div className="space-y-3 px-1">
        <div className="flex items-center justify-between text-xs">
          <span className="font-mono text-stone-300 uppercase tracking-widest flex items-center gap-1.5">
            <Globe className="w-3.5 h-3.5 text-cyan-400" />
            On-Chain Deposit Addresses
          </span>
          <span className="text-stone-400 font-mono text-[11px]">Universal Web3</span>
        </div>

        <div className="p-4 rounded-3xl bg-[#111118] border border-white/5 space-y-3">
          {/* Network Switcher */}
          <div className="grid grid-cols-3 gap-1.5 p-1 bg-white/5 rounded-2xl border border-white/5">
            {(['ton', 'polygon', 'solana'] as const).map((net) => (
              <button
                key={net}
                onClick={() => setActiveNetworkView(net)}
                className={`py-1.5 text-xs font-mono uppercase rounded-xl transition-all ${
                  activeNetworkView === net
                    ? 'bg-stone-100 text-stone-950 font-bold shadow-sm'
                    : 'text-stone-400 hover:text-stone-200'
                }`}
              >
                {net === 'ton' ? 'TON Network' : net === 'polygon' ? 'Polygon / EVM' : 'Solana'}
              </button>
            ))}
          </div>

          {/* Address Display Box with Copy */}
          <div className="flex items-center justify-between p-3 rounded-2xl bg-black/40 border border-white/10 font-mono text-xs text-stone-300">
            <div className="truncate mr-2">
              <span className="text-[10px] text-stone-500 block mb-0.5 uppercase">
                {activeNetworkView} Address (Public Key)
              </span>
              <span className="text-stone-200">{currentAddress}</span>
            </div>
            <button
              onClick={handleCopy}
              className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-stone-400 hover:text-amber-300 transition-colors shrink-0"
              title="Copy Address"
            >
              {copiedAddr ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
            </button>
          </div>

          <div className="flex items-center justify-between text-[11px] text-stone-400 pt-1">
            <span>• Supported by MetaMask, Trust Wallet, Tonkeeper, Phantom, Binance</span>
            <button
              onClick={() => setReceiveModalOpen(true)}
              className="text-cyan-300 hover:underline font-mono"
            >
              Show QR Code →
            </button>
          </div>
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

        <div className="space-y-2">
          {connectedWallets.length === 0 ? (
            <div className="p-3.5 rounded-2xl bg-white/[0.02] border border-white/5 text-xs text-stone-500 text-center">
              No external wallet connected. You can link Tonkeeper or MetaMask in Settings.
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
                  <span className="text-emerald-400 font-medium">{w.balance} USDT</span>
                  <span className="text-[10px] text-stone-500 block uppercase">{w.network}</span>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

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

      {/* Tether USDT Token Details Modal */}
      <UsdtAssetDetailsModal
        isOpen={usdtDetailsOpen}
        onClose={() => setUsdtDetailsOpen(false)}
      />
    </div>
  );
};
