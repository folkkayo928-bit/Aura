import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { supabase } from '../lib/supabase';
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
  const totalCost = numAmount;

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
            <h4 className="font-serif text-xl text-stone-100">{sentSuccessTxHash === 'internal' ? 'Transfer Sent' : 'Withdrawal Request Created'}</h4>
            <p className="text-xs text-stone-300">
              {sentSuccessTxHash === 'internal'
                ? `Transferred ${amount} USDT to ${recipient.slice(0, 8)}...`
                : `Your request for ${amount} USDT to ${recipient.slice(0, 8)}... was created.`}
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
                  ? `Recipient ${network.toUpperCase()} EVM Address`
                  : 'Recipient Telegram Handle or Vault ID'}
              </label>
              <input
                type="text"
                placeholder={
                  mode === 'external'
                    ? '0x71C...'
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
                  onClick={() => setAmount(Math.max(0, walletBalance).toFixed(2))}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] uppercase font-mono px-2 py-0.5 rounded bg-white/10 text-stone-300 hover:text-white"
                >
                  Max
                </button>
              </div>
            </div>

            {/* Fee summary */}
            <div className="p-3 rounded-xl bg-white/[0.02] border border-white/5 text-xs text-stone-400 space-y-1.5 font-mono">
              <div className="flex justify-between">
                <span>Network Fee:</span>
                <span className="text-amber-300">Calculated at broadcast</span>
              </div>
              <div className="flex justify-between font-semibold text-stone-100 pt-1 border-t border-white/5">
                <span>USDT Amount:</span>
                <span className="text-amber-300">${totalCost.toFixed(2)} USDT</span>
              </div>
              <p className="pt-1 text-[10px] text-stone-500">AURA will not pretend the network fee is $0. The actual chain fee is handled by the broadcaster.</p>
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
  const [copied, setCopied] = useState<string | null>(null);
  const [depositAddresses, setDepositAddresses] = useState<Record<string, string>>({});
  const [depositLoading, setDepositLoading] = useState(false);
  const [depositMessage, setDepositMessage] = useState<string | null>(null);
  const [receiveTab, setReceiveTab] = useState<'aura' | 'external'>('aura');
  const [selectedNetwork, setSelectedNetwork] = useState<'polygon' | 'ethereum' | 'arbitrum' | 'bsc'>('polygon');
  const [qrCodeUrl, setQrCodeUrl] = useState('');

  React.useEffect(() => {
    if (!receiveModalOpen) return;
    let cancelled = false;

    const loadDepositAddresses = async () => {
      setDepositLoading(true);
      setDepositMessage(null);

      const { data, error } = await supabase.functions.invoke('provision-deposit-address', {
        body: {},
      });

      if (cancelled) return;

      if (error || !data?.success) {
        setDepositAddresses({});
        setDepositMessage(
          data?.message ||
          (data?.error === 'DEPOSIT_ADDRESS_PROVISIONING_UNAVAILABLE'
            ? 'External USDT receiving is not enabled yet.'
            : 'External USDT receiving is temporarily unavailable.'),
        );
      } else {
        const fromLegacyShape = data.addresses || {};
        const fromCurrentShape = Object.fromEntries(
          (Array.isArray(data.chains) ? data.chains : [])
            .filter((item: any) => item?.chain)
            .map((item: any) => [item.chain, item.address || '']),
        );
        const addresses = Object.keys(fromLegacyShape).length ? fromLegacyShape : fromCurrentShape;
        setDepositAddresses({
          ethereum: addresses.ethereum || '',
          polygon: addresses.polygon || '',
          arbitrum: addresses.arbitrum || '',
          bsc: addresses.bsc || '',
        });
      }

      setDepositLoading(false);
    };

    void loadDepositAddresses();
    return () => { cancelled = true; };
  }, [receiveModalOpen]);

  const externalAddress = depositAddresses[selectedNetwork] || '';
  const auraReceiveValue = userProfile.telegramHandle && userProfile.telegramHandle !== '@collector'
    ? `aura.tg://${userProfile.telegramHandle}`
    : userProfile.vaultId || '';

  React.useEffect(() => {
    const value = receiveTab === 'external' ? externalAddress : auraReceiveValue;
    if (!value) {
      setQrCodeUrl('');
      return;
    }

    let cancelled = false;
    void import('qrcode')
      .then(({ default: QRCode }) => QRCode.toDataURL(value, {
        width: 220,
        margin: 1,
        errorCorrectionLevel: 'M',
      }))
      .then((url) => {
        if (!cancelled) setQrCodeUrl(url);
      })
      .catch(() => {
        if (!cancelled) setQrCodeUrl('');
      });

    return () => { cancelled = true; };
  }, [receiveTab, externalAddress, auraReceiveValue]);

  if (!receiveModalOpen) return null;

  const handleCopy = (value: string) => {
    if (!value) return;
    void navigator.clipboard?.writeText(value);
    setCopied(value);
    setTimeout(() => setCopied(null), 1800);
  };

  const auraHandle = userProfile.telegramHandle || '@collector';

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/85 backdrop-blur-md p-0 sm:p-4">
      <div className="w-full max-w-md bg-[#12121a] border border-white/10 rounded-t-3xl sm:rounded-3xl p-5 shadow-2xl max-h-[92vh] overflow-y-auto no-scrollbar">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <QrCode className="w-4 h-4 text-cyan-400" />
            <span className="text-xs uppercase tracking-widest font-mono text-stone-300">Receive into AURA</span>
          </div>
          <button
            onClick={() => setReceiveModalOpen(false)}
            className="w-8 h-8 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-stone-400"
            aria-label="Close receive"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="grid grid-cols-2 gap-1 p-1 bg-white/5 rounded-2xl border border-white/5 mb-4">
          <button
            type="button"
            onClick={() => setReceiveTab('aura')}
            className={`py-2.5 text-[11px] font-semibold rounded-xl transition-all ${receiveTab === 'aura' ? 'bg-cyan-400 text-slate-950 shadow-sm' : 'text-stone-400 hover:text-stone-200'}`}
          >
            AURA User
          </button>
          <button
            type="button"
            onClick={() => setReceiveTab('external')}
            className={`py-2.5 text-[11px] font-semibold rounded-xl transition-all ${receiveTab === 'external' ? 'bg-cyan-400 text-slate-950 shadow-sm' : 'text-stone-400 hover:text-stone-200'}`}
          >
            External Wallet
          </button>
        </div>

        {receiveTab === 'aura' ? (
          <div className="rounded-3xl bg-cyan-950/20 border border-cyan-500/20 p-4 space-y-4">
            <div>
              <span className="text-[10px] font-mono uppercase tracking-wider text-cyan-300">AURA username</span>
              <div className="mt-2 flex items-center gap-2">
                <div className="flex-1 rounded-2xl bg-black/30 border border-white/10 p-3 text-sm text-stone-100">
                  {auraHandle}
                </div>
                <button onClick={() => handleCopy(auraHandle)} className="p-3 rounded-2xl bg-white/5 text-stone-300" aria-label="Copy AURA username">
                  {copied === auraHandle ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                </button>
              </div>
              <p className="mt-2 text-[11px] text-stone-400">
                Another AURA user can send USDT to this username without needing your blockchain address.
              </p>
            </div>

            <div className="flex justify-center rounded-2xl bg-white p-4">
              {qrCodeUrl ? (
                <img src={qrCodeUrl} alt="AURA username QR code" className="w-44 h-44 rounded-xl" />
              ) : (
                <div className="w-44 h-44 rounded-xl bg-slate-100/10 animate-pulse" />
              )}
            </div>

            <div className="pt-3 border-t border-white/10">
              <span className="text-[10px] font-mono uppercase tracking-wider text-stone-500">AURA Vault ID</span>
              <div className="mt-2 flex items-center gap-2">
                <div className="flex-1 rounded-2xl bg-black/30 border border-white/10 p-3 font-mono text-[11px] text-cyan-200 break-all">
                  {userProfile.vaultId}
                </div>
                <button onClick={() => handleCopy(userProfile.vaultId)} className="p-3 rounded-2xl bg-white/5 text-stone-300" aria-label="Copy AURA Vault ID">
                  {copied === userProfile.vaultId ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div className="rounded-3xl bg-cyan-950/20 border border-cyan-500/20 p-4 space-y-4">
            <div>
              <span className="text-[10px] font-mono uppercase tracking-wider text-cyan-300">Receive USDT on-chain</span>
              <p className="mt-1 text-[11px] text-stone-400 leading-relaxed">
                Choose the network used by the sender. The address is copied exactly; AURA credits deposits only after its on-chain confirmation process.
              </p>
            </div>

            <div className="grid grid-cols-3 gap-1.5">
              {(['polygon', 'ethereum', 'arbitrum'] as const).map((chain) => (
                <button
                  type="button"
                  key={chain}
                  onClick={() => setSelectedNetwork(chain)}
                  className={`py-2.5 rounded-xl text-[10px] font-mono uppercase border transition-all ${selectedNetwork === chain ? 'border-cyan-400/80 bg-cyan-400/10 text-cyan-200 font-bold' : 'border-white/5 bg-white/[0.02] text-stone-400'}`}
                >
                  {chain}
                </button>
              ))}
            </div>

            <div className="flex items-center justify-between rounded-xl bg-white/[0.03] border border-white/5 px-3 py-2">
              <span className="text-[10px] uppercase font-mono text-stone-400">Asset</span>
              <span className="text-xs font-semibold text-stone-100">USDT</span>
            </div>

            {depositLoading ? (
              <div className="rounded-2xl bg-black/20 border border-white/10 p-4 text-xs text-stone-400 text-center">
                Preparing your secure deposit address…
              </div>
            ) : externalAddress ? (
              <>
                <div className="flex justify-center rounded-2xl bg-white p-4">
                  {qrCodeUrl ? (
                    <img src={qrCodeUrl} alt={`${selectedNetwork} USDT deposit QR code`} className="w-48 h-48 rounded-xl" />
                  ) : (
                    <div className="w-48 h-48 rounded-xl bg-slate-100/10 animate-pulse" />
                  )}
                </div>

                <div className="rounded-2xl bg-black/20 border border-white/10 p-3">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <span className="text-[10px] uppercase font-mono text-cyan-300">{selectedNetwork} · USDT</span>
                      <p className="mt-1 text-[9px] text-stone-500">Only send USDT on this network.</p>
                    </div>
                    <button onClick={() => handleCopy(externalAddress)} className="p-2 rounded-lg bg-white/5 text-stone-300" aria-label={`Copy ${selectedNetwork} USDT address`}>
                      {copied === externalAddress ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                    </button>
                  </div>
                  <div className="mt-3 font-mono text-[10px] text-cyan-200 break-all">{externalAddress}</div>
                </div>
              </>
            ) : (
              <div className="rounded-2xl bg-black/20 border border-amber-500/20 p-4 text-[11px] text-stone-400 leading-relaxed">
                {depositMessage || 'External USDT receiving is currently unavailable.'}
              </div>
            )}

            <div className="text-[10px] text-stone-500 leading-relaxed">
              Never send another token or use a different network to this address. Sending the wrong asset or network can permanently lose funds.
            </div>
          </div>
        )}

        <button onClick={() => setReceiveModalOpen(false)} className="mt-4 w-full py-3 rounded-xl bg-white/5 text-stone-300 text-xs font-semibold">
          Done
        </button>
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
