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
    userProfile,
    requestWalletWithdrawal,
  } = useApp();

  const [mode, setMode] = useState<'external' | 'internal'>('external');
  const [network, setNetwork] = useState<CryptoNetwork>('polygon');
  const [recipient, setRecipient] = useState('');
  const [amount, setAmount] = useState('');
  const [sentSuccessTxHash, setSentSuccessTxHash] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!sendModalOpen) return null;

  const currentGas = 0;
  const numAmount = parseFloat(amount) || 0;
  const totalCost = numAmount + currentGas;

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!recipient.trim() || numAmount <= 0) return;

    if (mode === 'internal') {
      const ok = await sendInternalFunds(recipient.trim(), numAmount);
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
      setIsSubmitting(true);
      const res = await requestWalletWithdrawal({
        chain: network,
        destinationAddress: recipient.trim(),
        amount: numAmount,
        networkFee: 0,
      });
      setIsSubmitting(false);
      if (res.success) {
        setSentSuccessTxHash('withdrawal-requested');
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
            <h4 className="font-serif text-xl text-stone-100">Withdrawal Requested</h4>
            <p className="text-xs text-stone-300">
              Transferred ${amount} USDT to {recipient.slice(0, 8)}...
            </p>
            {sentSuccessTxHash !== 'internal' && (
              <div className="p-2.5 rounded-xl bg-white/5 font-mono text-[10px] text-cyan-300 break-all border border-white/5">
                Confirm the withdrawal email sent to your account. Blockchain broadcast occurs only after confirmation.
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
                  {(['polygon', 'arbitrum', 'ethereum'] as const).map((net) => (
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
              disabled={isSubmitting || !recipient || numAmount <= 0 || totalCost > walletBalance}
              className="w-full py-4 rounded-xl bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 text-stone-950 font-bold text-xs transition-all shadow-lg shadow-amber-500/10 active:scale-[0.98] disabled:opacity-40"
            >
              {isSubmitting ? 'Submitting…' : mode === 'external' ? `Request ${network.toUpperCase()} Withdrawal` : 'Transfer Instantly'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
};

export const ReceiveModal: React.FC = () => {
  const { receiveModalOpen, setReceiveModalOpen, userProfile } = useApp();
  const [copied, setCopied] = useState(false);

  if (!receiveModalOpen) return null;

  const handleCopy = () => {
    navigator.clipboard?.writeText(userProfile.vaultId);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/85 backdrop-blur-md p-0 sm:p-4">
      <div className="w-full max-w-md bg-[#12121a] border border-white/10 rounded-t-3xl sm:rounded-3xl p-6 shadow-2xl">
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2">
            <QrCode className="w-4 h-4 text-cyan-400" />
            <span className="text-xs uppercase tracking-widest font-mono text-stone-300">Receive into AURA</span>
          </div>
          <button onClick={() => setReceiveModalOpen(false)} className="w-8 h-8 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-stone-400">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="rounded-3xl bg-cyan-950/20 border border-cyan-500/20 p-5 space-y-4">
          <div>
            <span className="text-[10px] font-mono uppercase tracking-wider text-cyan-300">AURA Vault ID</span>
            <div className="mt-2 flex items-center gap-2">
              <div className="flex-1 rounded-2xl bg-black/30 border border-white/10 p-3 font-mono text-xs text-cyan-200 break-all">{userProfile.vaultId}</div>
              <button onClick={handleCopy} className="p-3 rounded-2xl bg-white/5 text-stone-300">
                {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
              </button>
            </div>
          </div>
          <div>
            <span className="text-[10px] font-mono uppercase tracking-wider text-stone-500">AURA handle</span>
            <div className="mt-1 text-lg font-serif text-stone-100">{userProfile.telegramHandle}</div>
          </div>
          <p className="text-[11px] text-stone-400 leading-relaxed">
            Share your Vault ID or handle with another AURA account to receive internal USDT. AURA does not display a fake blockchain deposit address. External on-chain receiving will be available after a supported custody/provider connection is enabled.
          </p>
        </div>

        <button onClick={() => setReceiveModalOpen(false)} className="mt-5 w-full py-3 rounded-xl bg-white/5 text-stone-300 text-xs font-semibold">Done</button>
      </div>
    </div>
  );
};

export const BuyModal: React.FC = () => {
  const { buyModalOpen, setBuyModalOpen, setP2pModalOpen } = useApp();
  if (!buyModalOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/85 backdrop-blur-md p-0 sm:p-4">
      <div className="w-full max-w-md bg-[#12121a] border border-white/10 rounded-t-3xl sm:rounded-3xl p-6 shadow-2xl">
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2">
            <PlusCircle className="w-4 h-4 text-amber-400" />
            <span className="text-xs uppercase tracking-widest font-mono text-stone-300">Fund AURA Wallet</span>
          </div>
          <button onClick={() => setBuyModalOpen(false)} className="w-8 h-8 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-stone-400">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="rounded-3xl bg-amber-400/10 border border-amber-400/20 p-5 space-y-3">
          <div className="flex items-center gap-2 text-amber-300 font-semibold text-sm">
            <ShieldCheck className="w-4 h-4" />
            Buy through the AURA P2P Desk
          </div>
          <p className="text-xs text-stone-300 leading-relaxed">
            Choose a live offer, review the payment instructions, and open a trade. AURA reserves the seller's internal USDT during the order.
          </p>
          <button
            onClick={() => {
              setBuyModalOpen(false);
              setP2pModalOpen(true);
            }}
            className="w-full py-3.5 rounded-xl bg-amber-400 text-stone-950 font-bold text-xs"
          >
            Open P2P Market
          </button>
        </div>

        <p className="mt-4 text-[10px] leading-relaxed text-stone-500">
          AURA does not create or simulate USDT deposits. External blockchain funding requires a real wallet/provider integration.
        </p>
      </div>
    </div>
  );
};
