import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { CryptoNetwork } from '../types';
import {
  X,
  Send,
  QrCode,
  Copy,
  Check,
  PlusCircle,
  ShieldCheck,
  Globe,
  Zap,
  ArrowRight,
  ExternalLink,
  Info,
} from 'lucide-react';

export const SendModal: React.FC = () => {
  const {
    sendModalOpen,
    setSendModalOpen,
    walletBalance,
    sendInternalFunds,
    sendExternalCrypto,
    userProfile,
  } = useApp();

  const [mode, setMode] = useState<'external' | 'internal'>('external');
  const [network, setNetwork] = useState<CryptoNetwork>('polygon');
  const [recipient, setRecipient] = useState('');
  const [amount, setAmount] = useState('');
  const [sentSuccessTxHash, setSentSuccessTxHash] = useState<string | null>(null);

  if (!sendModalOpen) return null;

  const gasFeeMap: Record<CryptoNetwork, number> = {
    ton: 0.05,
    polygon: 0.02,
    arbitrum: 0.1,
    ethereum: 1.5,
    solana: 0.01,
  };

  const currentGas = mode === 'external' ? gasFeeMap[network] : 0.0;
  const numAmount = parseFloat(amount) || 0;
  const totalCost = numAmount + currentGas;

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!recipient.trim() || numAmount <= 0) return;

    if (mode === 'internal') {
      const ok = sendInternalFunds(recipient.trim(), numAmount);
      if (ok) {
        setSentSuccessTxHash('internal');
        setTimeout(() => {
          setSentSuccessTxHash(null);
          setSendModalOpen(false);
          setRecipient('');
          setAmount('');
        }, 1800);
      }
    } else {
      const res = sendExternalCrypto({
        network,
        destinationAddress: recipient.trim(),
        amount: numAmount,
        gasFee: currentGas,
      });
      if (res.success) {
        setSentSuccessTxHash(res.txHash);
        setTimeout(() => {
          setSentSuccessTxHash(null);
          setSendModalOpen(false);
          setRecipient('');
          setAmount('');
        }, 2500);
      }
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/85 backdrop-blur-md p-0 sm:p-4">
      <div
        className="w-full max-w-md bg-[#12121a] border border-white/10 rounded-t-3xl sm:rounded-3xl p-6 shadow-2xl animate-in slide-in-from-bottom-6 max-h-[92vh] overflow-y-auto no-scrollbar"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Send className="w-4 h-4 text-amber-400" />
            <span className="text-xs uppercase tracking-widest font-mono text-stone-300">
              Send Cryptocurrency
            </span>
          </div>
          <button
            onClick={() => setSendModalOpen(false)}
            className="w-8 h-8 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-stone-400 hover:text-stone-100"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {sentSuccessTxHash ? (
          <div className="py-8 text-center space-y-3">
            <div className="w-14 h-14 rounded-full bg-emerald-500/20 text-emerald-400 mx-auto flex items-center justify-center border border-emerald-500/30">
              <Check className="w-7 h-7" />
            </div>
            <h4 className="font-serif text-xl text-stone-100">Broadcast Confirmed</h4>
            <p className="text-xs text-stone-300">
              Transferred ${amount} USDT to {recipient.slice(0, 8)}...
            </p>
            {sentSuccessTxHash !== 'internal' && (
              <div className="p-2.5 rounded-xl bg-white/5 font-mono text-[10px] text-cyan-300 break-all border border-white/5">
                TxHash: {sentSuccessTxHash}
              </div>
            )}
          </div>
        ) : (
          <form onSubmit={handleSend} className="space-y-4">
            {/* Mode Switcher: External Web3 vs Internal Telegram */}
            <div className="grid grid-cols-2 gap-1 p-1 bg-white/5 rounded-2xl border border-white/5">
              <button
                type="button"
                onClick={() => setMode('external')}
                className={`py-2 text-xs font-semibold rounded-xl transition-all ${
                  mode === 'external'
                    ? 'bg-amber-400 text-stone-950 shadow-sm'
                    : 'text-stone-400 hover:text-stone-200'
                }`}
              >
                External Web3 Address
              </button>
              <button
                type="button"
                onClick={() => setMode('internal')}
                className={`py-2 text-xs font-semibold rounded-xl transition-all ${
                  mode === 'internal'
                    ? 'bg-amber-400 text-stone-950 shadow-sm'
                    : 'text-stone-400 hover:text-stone-200'
                }`}
              >
                Telegram @User / Vault
              </button>
            </div>

            {/* External Network Selector */}
            {mode === 'external' && (
              <div>
                <label className="text-xs text-stone-400 block mb-1 font-medium">Select Blockchain Network</label>
                <div className="grid grid-cols-3 gap-1.5">
                  {(['ton', 'polygon', 'arbitrum', 'ethereum', 'solana'] as const).map((net) => (
                    <button
                      type="button"
                      key={net}
                      onClick={() => setNetwork(net)}
                      className={`p-2 rounded-xl text-xs font-mono uppercase border transition-all text-center ${
                        network === net
                          ? 'border-amber-400/80 bg-amber-400/10 text-amber-300 font-bold'
                          : 'border-white/5 bg-white/[0.02] text-stone-400'
                      }`}
                    >
                      {net}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Recipient Address */}
            <div>
              <label className="text-xs text-stone-400 block mb-1.5 font-medium">
                {mode === 'external'
                  ? `Recipient ${network.toUpperCase()} Address (MetaMask, Phantom, Tonkeeper, Binance)`
                  : 'Recipient Telegram Handle or Vault ID'}
              </label>
              <input
                type="text"
                placeholder={
                  mode === 'external'
                    ? network === 'ton'
                      ? 'EQB...'
                      : network === 'solana'
                      ? '7xK...'
                      : '0x71C...'
                    : '@username or aura.tg://...'
                }
                value={recipient}
                onChange={(e) => setRecipient(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-3.5 py-2.5 text-xs text-stone-100 font-mono focus:outline-none focus:border-amber-400/60"
                required
              />
            </div>

            {/* Amount */}
            <div>
              <div className="flex items-center justify-between text-xs text-stone-400 mb-1.5">
                <span>Amount (USDT)</span>
                <span className="font-mono">Available: ${walletBalance.toFixed(2)}</span>
              </div>
              <div className="relative">
                <input
                  type="number"
                  step="any"
                  placeholder="0.00"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-stone-100 focus:outline-none focus:border-amber-400/60 font-mono"
                  required
                />
                <button
                  type="button"
                  onClick={() => setAmount(Math.max(0, walletBalance - currentGas).toFixed(2))}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] uppercase font-mono px-2 py-0.5 rounded bg-white/10 text-stone-300 hover:text-white"
                >
                  Max
                </button>
              </div>
            </div>

            {/* Fee summary */}
            <div className="p-3 rounded-xl bg-white/[0.02] border border-white/5 text-xs text-stone-400 space-y-1.5 font-mono">
              <div className="flex justify-between">
                <span>Network Gas Fee:</span>
                <span className="text-stone-200">${currentGas.toFixed(2)} USDT</span>
              </div>
              <div className="flex justify-between font-semibold text-stone-100 pt-1 border-t border-white/5">
                <span>Total Debit:</span>
                <span className="text-amber-300">${totalCost.toFixed(2)} USDT</span>
              </div>
            </div>

            <button
              type="submit"
              disabled={!recipient || numAmount <= 0 || totalCost > walletBalance}
              className="w-full py-4 rounded-xl bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 text-stone-950 font-bold text-xs transition-all shadow-lg shadow-amber-500/10 active:scale-[0.98] disabled:opacity-40"
            >
              {mode === 'external' ? `Broadcast to ${network.toUpperCase()}` : 'Transfer Instantly'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
};

export const ReceiveModal: React.FC = () => {
  const { receiveModalOpen, setReceiveModalOpen, vaultAddresses, userProfile, simulateInboundDeposit } = useApp();
  const [network, setNetwork] = useState<CryptoNetwork>('polygon');
  const [copied, setCopied] = useState(false);

  if (!receiveModalOpen) return null;

  const currentAddress =
    network === 'ton'
      ? vaultAddresses.ton
      : network === 'solana'
      ? vaultAddresses.solana
      : vaultAddresses.polygon;

  const handleCopy = () => {
    navigator.clipboard?.writeText(currentAddress);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/85 backdrop-blur-md p-0 sm:p-4">
      <div
        className="w-full max-w-md bg-[#12121a] border border-white/10 rounded-t-3xl sm:rounded-3xl p-6 shadow-2xl animate-in slide-in-from-bottom-6 max-h-[92vh] overflow-y-auto no-scrollbar"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <QrCode className="w-4 h-4 text-cyan-400" />
            <span className="text-xs uppercase tracking-widest font-mono text-stone-300">
              Receive Crypto & Art
            </span>
          </div>
          <button
            onClick={() => setReceiveModalOpen(false)}
            className="w-8 h-8 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-stone-400 hover:text-stone-100"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Network Picker */}
        <div className="mb-4">
          <span className="text-[11px] text-stone-400 block mb-1.5 font-medium">Select Deposit Network</span>
          <div className="grid grid-cols-3 gap-1.5">
            {(['ton', 'polygon', 'arbitrum', 'ethereum', 'solana'] as const).map((net) => (
              <button
                key={net}
                onClick={() => setNetwork(net)}
                className={`py-1.5 px-2 rounded-xl text-xs font-mono uppercase border transition-all text-center ${
                  network === net
                    ? 'border-cyan-400 bg-cyan-950/40 text-cyan-300 font-bold'
                    : 'border-white/5 bg-white/[0.02] text-stone-400'
                }`}
              >
                {net}
              </button>
            ))}
          </div>
        </div>

        {/* Real QR Code container */}
        <div className="p-4 bg-white rounded-2xl w-44 h-44 mx-auto flex flex-col items-center justify-center mb-4 shadow-inner">
          <div className="grid grid-cols-6 gap-1.5 w-36 h-36">
            {Array.from({ length: 36 }).map((_, i) => (
              <div
                key={i}
                className={`rounded-xs ${
                  i % 2 === 0 || i % 5 === 0 || i === 14 || i === 22 ? 'bg-stone-950' : 'bg-stone-200'
                }`}
              />
            ))}
          </div>
        </div>

        {/* Deposit Address Box */}
        <div className="space-y-2 mb-4">
          <div className="flex items-center justify-between text-xs text-stone-400 px-1">
            <span>Your {network.toUpperCase()} Vault Address</span>
            <span className="text-emerald-400 font-mono text-[10px]">Active</span>
          </div>
          <div className="flex items-center justify-between gap-2 bg-white/5 p-3 rounded-2xl border border-white/10 font-mono text-xs text-stone-200">
            <span className="truncate">{currentAddress}</span>
            <button
              onClick={handleCopy}
              className="p-1 text-stone-400 hover:text-amber-300 transition-colors shrink-0"
              title="Copy Address"
            >
              {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {/* External Web3 Deposit Notice */}
        <div className="flex items-start gap-2 p-3 rounded-xl bg-white/[0.02] border border-white/5 text-[11px] text-stone-400 leading-relaxed mb-4">
          <Info className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
          <span>
            Send USDT or digital art directly from MetaMask, Tonkeeper, Binance, or any Web3 platform. Deposits are detected in real-time.
          </span>
        </div>

        {/* Inbound Simulator for testing */}
        <button
          onClick={() => {
            simulateInboundDeposit(network, 50);
            setReceiveModalOpen(false);
          }}
          className="w-full py-3.5 rounded-xl bg-cyan-500/20 hover:bg-cyan-500/30 border border-cyan-500/40 text-cyan-300 font-semibold text-xs transition-colors flex items-center justify-center gap-1.5"
        >
          <Zap className="w-3.5 h-3.5" />
          <span>Simulate Inbound Web3 Deposit (+50 USDT)</span>
        </button>
      </div>
    </div>
  );
};

export const BuyModal: React.FC = () => {
  const { buyModalOpen, setBuyModalOpen, topUpBalance, setP2pModalOpen } = useApp();

  if (!buyModalOpen) return null;

  const packages = [25, 50, 100, 250];

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/85 backdrop-blur-md p-0 sm:p-4">
      <div
        className="w-full max-w-md bg-[#12121a] border border-white/10 rounded-t-3xl sm:rounded-3xl p-6 shadow-2xl animate-in slide-in-from-bottom-6 max-h-[92vh] overflow-y-auto no-scrollbar"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <PlusCircle className="w-4 h-4 text-amber-400" />
            <span className="text-xs uppercase tracking-widest font-mono text-stone-300">
              Buy USDT Balance
            </span>
          </div>
          <button
            onClick={() => setBuyModalOpen(false)}
            className="w-8 h-8 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-stone-400 hover:text-stone-100"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Binance P2P Banner */}
        <div
          onClick={() => {
            setBuyModalOpen(false);
            setP2pModalOpen(true);
          }}
          className="p-3.5 rounded-2xl bg-gradient-to-r from-amber-400/20 via-stone-800 to-amber-500/10 border border-amber-400/30 cursor-pointer hover:border-amber-400/60 transition-all mb-4 flex items-center justify-between"
        >
          <div>
            <div className="flex items-center gap-1.5 text-amber-300 font-semibold text-xs">
              <ShieldCheck className="w-4 h-4" />
              <span>Recommended: Binance-Style P2P Desk</span>
            </div>
            <p className="text-[11px] text-stone-300 mt-0.5">
              Buy with Revolut, Bank Wire, Wise, or Telegram Pay with 0% fee.
            </p>
          </div>
          <ArrowRight className="w-4 h-4 text-amber-300 shrink-0 ml-2" />
        </div>

        <div className="text-xs text-stone-400 mb-3 font-medium">Or Quick Simulated Top-Up:</div>

        <div className="grid grid-cols-2 gap-3 mb-5">
          {packages.map((amt) => (
            <button
              key={amt}
              onClick={() => {
                topUpBalance(amt);
                setBuyModalOpen(false);
              }}
              className="p-4 rounded-2xl bg-white/5 hover:bg-amber-400 hover:text-stone-950 border border-white/5 transition-all text-center group"
            >
              <span className="text-xs text-stone-400 group-hover:text-stone-800 block">Add</span>
              <span className="font-serif text-2xl font-semibold text-stone-100 group-hover:text-stone-950">
                ${amt}
              </span>
            </button>
          ))}
        </div>

        <button
          onClick={() => setBuyModalOpen(false)}
          className="w-full py-3 rounded-xl bg-white/5 text-stone-400 hover:text-stone-200 text-xs font-medium"
        >
          Close
        </button>
      </div>
    </div>
  );
};
