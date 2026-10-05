import React, { useState, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../lib/supabase';
import { P2POffer, PaymentMethodType, P2PChatMessage } from '../../types';
import { formatPaymentMethodLabel } from './CustomPaymentMethodInput';
import {
  X,
  ShieldCheck,
  CheckCircle2,
  Copy,
  Check,
  Clock,
  ArrowRight,
  AlertTriangle,
  Lock,
  MessageSquare,
  Send,
  HelpCircle,
  BadgeCheck,
} from 'lucide-react';

interface P2PTradeModalProps {
  offer: P2POffer | null;
  onClose: () => void;
}

export const P2PTradeModal: React.FC<P2PTradeModalProps> = ({ offer, onClose }) => {
  const {
    startP2POrder,
    activeP2POrder,
    markP2PPaymentSent,
    completeP2POrder,
    cancelP2POrder,
    raiseP2PDispute,
    walletBalance,
  } = useApp();
  const { user } = useAuth();

  const [cryptoAmount, setCryptoAmount] = useState<string>('50');
  const [selectedMethod, setSelectedMethod] = useState<PaymentMethodType>(
    offer ? offer.paymentMethods[0] : 'telegram_pay'
  );
  const [copiedRef, setCopiedRef] = useState(false);
  const [copiedAccount, setCopiedAccount] = useState(false);
  const [timeLeftSeconds, setTimeLeftSeconds] = useState(900); // 15 mins
  const [chatOpen, setChatOpen] = useState(false);
  const [chatInput, setChatInput] = useState('');
  const [receiveAccount, setReceiveAccount] = useState('');
  const [paymentProof, setPaymentProof] = useState<File | null>(null);
  const [paymentProofUrl, setPaymentProofUrl] = useState<string | null>(null);
  const [proofUploading, setProofUploading] = useState(false);
  const [proofs, setProofs] = useState<Array<{ id: string; file_name: string; mime_type: string; note?: string | null; created_at: string; url?: string }>>([]);
  const [messages, setMessages] = useState<P2PChatMessage[]>([
    {
      id: 'm-sys-1',
      sender: 'system',
      senderName: 'AURA Trade System',
      text: '🔒 AURA ledger hold is active. The seller balance is reserved until the payment step is completed or the order is cancelled.',
      timestamp: 'Just now',
    },
  ]);

  useEffect(() => {
    if (!activeP2POrder?.id || !user) return;
    void (async () => {
      const { data } = await supabase
        .from('p2p_messages')
        .select('id,text,created_at,sender_id,sender_role,sender:sender_id(display_name,handle)')
        .eq('order_id', activeP2POrder.id)
        .order('created_at', { ascending: true });
      if (!data) return;
      setMessages((data as any[]).map((m) => ({
        id: m.id,
        sender: m.sender_role === 'system' ? 'system' : m.sender_id === user.id ? 'buyer' : 'merchant',
        senderName: m.sender?.display_name || m.sender?.handle || 'AURA Member',
        text: m.text,
        timestamp: new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      })));
    })();
  }, [activeP2POrder?.id, user]);

  useEffect(() => {
    if (!activeP2POrder?.id) {
      setProofs([]);
      return;
    }
    void (async () => {
      const { data } = await supabase
        .from('p2p_payment_proofs')
        .select('id,storage_path,file_name,note,created_at')
        .eq('order_id', activeP2POrder.id)
        .order('created_at', { ascending: true });
      const rows = (data || []) as any[];
      const enriched = await Promise.all(rows.map(async (p) => {
        const signed = await supabase.storage.from('aura-p2p-proofs').createSignedUrl(p.storage_path, 600);
        return { ...p, url: signed.data?.signedUrl || undefined };
      }));
      setProofs(enriched);
    })();
  }, [activeP2POrder?.id, activeP2POrder?.status]);

  useEffect(() => {
    if (offer && offer.paymentMethods.length > 0) {
      setSelectedMethod(offer.paymentMethods[0]);
    }
  }, [offer]);

  useEffect(() => {
    if (activeP2POrder && activeP2POrder.status === 'payment_marked') {
      const timer = setInterval(() => {
        setTimeLeftSeconds((prev) => Math.max(0, prev - 1));
      }, 1000);
      return () => clearInterval(timer);
    }
  }, [activeP2POrder]);

  if (!offer && !activeP2POrder) return null;

  const currentOffer = offer || {
    id: activeP2POrder?.offerId || '',
    type: activeP2POrder?.type || 'buy',
    merchant: activeP2POrder?.merchant!,
    pricePerUnit: activeP2POrder && activeP2POrder.cryptoAmount > 0
      ? activeP2POrder.fiatAmount / activeP2POrder.cryptoAmount
      : 0,
    fiatCurrency: activeP2POrder?.fiatCurrency || 'USD',
    availableCrypto: 0,
    minLimitFiat: 0,
    maxLimitFiat: 0,
    paymentMethods: activeP2POrder ? [activeP2POrder.paymentMethod] : [],
    paymentInstructions: '',
    isSmartEscrowLocked: activeP2POrder?.status === 'escrow_locked',
    isBuyerProtected: false,
    artworkId: activeP2POrder?.artwork?.id,
    artworkTitle: activeP2POrder?.artwork?.title,
    artworkImage: activeP2POrder?.artwork?.image,
  };

  const typedOffer = currentOffer as P2POffer;
  const hasUsableOffer = Boolean(offer && offer.pricePerUnit > 0 && offer.paymentMethods.length > 0);
  const isArtworkOffer = Boolean(typedOffer.artworkId);
  const numCrypto = isArtworkOffer ? 1 : (parseFloat(cryptoAmount) || 0);
  const fiatTotal = numCrypto * currentOffer.pricePerUnit;

  const handleStartTrade = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!offer || !hasUsableOffer || numCrypto <= 0) return;
    if (!isArtworkOffer && offer.type === 'buy' && !receiveAccount.trim()) {
      alert('Add the account or handle where the buyer should send your fiat payment.');
      return;
    }
    try {
      await startP2POrder({
        offer,
        cryptoAmount: numCrypto,
        paymentMethod: selectedMethod,
        paymentDetails: offer.type === 'buy'
          ? { accountName: user?.user_metadata?.name || undefined, accountNumberOrId: receiveAccount.trim() }
          : undefined,
      });
    } catch (err: any) {
      alert(err.message || 'Error creating P2P order');
    }
  };

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim()) return;
    const newMsg: P2PChatMessage = {
      id: `chat-${Date.now()}`,
      sender: activeP2POrder?.sellerId === user?.id ? 'merchant' : 'buyer',
      senderName: 'You',
      text: chatInput.trim(),
      timestamp: 'Just now',
    };
    setMessages((prev) => [...prev, newMsg]);
    setChatInput('');
    if (user && activeP2POrder) {
      void supabase.from('p2p_messages').insert({
        order_id: activeP2POrder.id,
        sender_id: user.id,
        sender_role: user.id === activeP2POrder.sellerId ? 'seller' : 'buyer',
        text: chatInput.trim(),
      });
    }
  };

  const minutes = Math.floor(timeLeftSeconds / 60);
  const seconds = timeLeftSeconds % 60;
  const timeFormatted = `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/85 backdrop-blur-md p-0 sm:p-4">
      <div
        className="w-full max-w-md bg-[#12121a] border border-white/10 rounded-t-3xl sm:rounded-3xl p-6 shadow-2xl animate-in slide-in-from-bottom-6 max-h-[92vh] overflow-y-auto no-scrollbar"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <span className="text-xs uppercase tracking-widest font-mono text-stone-300">
              {activeP2POrder
                ? (activeP2POrder.artwork ? 'Artwork P2P Order' : 'USDT P2P Order')
                : (isArtworkOffer ? 'Buy Artwork through AURA P2P' : `${currentOffer.type === 'sell' ? 'Buy' : 'Sell'} USDT with AURA Ledger Hold`)}
            </span>
          </div>
          <button
            onClick={() => {
              if (activeP2POrder) {
                if (window.confirm('Leave active trade view? Your trade remains active in the background.')) {
                  onClose();
                }
              } else {
                onClose();
              }
            }}
            className="w-8 h-8 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-stone-400 hover:text-stone-100"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* ACTIVE ESCROW TRADE STATE */}
        {activeP2POrder ? (
          <div className="space-y-4">
            {/* Status Progress Stepper */}
            <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/10 space-y-3">
              <div className="flex items-center justify-between text-xs">
                <span className="text-stone-400">Order ID:</span>
                <span className="font-mono text-stone-200">{activeP2POrder.id}</span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-stone-400">Trade State:</span>
                <span className="font-mono text-emerald-400 flex items-center gap-1">
                  <BadgeCheck className="w-3.5 h-3.5 text-emerald-400" />
                  {activeP2POrder.artwork
                    ? `AURA ownership transfer · Order reference ${activeP2POrder.escrowTxHash}`
                    : `AURA ledger hold · Order reference ${activeP2POrder.escrowTxHash}`}
                </span>
              </div>
              <div className="flex items-center justify-between text-xs pt-1 border-t border-white/5">
                <span className="text-stone-400">Payment Window:</span>
                <span className="font-mono text-amber-300 font-semibold flex items-center gap-1">
                  <Clock className="w-3 h-3" /> {timeFormatted}
                </span>
              </div>
            </div>

            {/* Merchant Details & Amounts */}
            <div className="p-4 rounded-2xl bg-stone-900/60 border border-white/5 space-y-2">
              <div className="flex justify-between text-xs text-stone-400">
                <span>Counterparty:</span>
                <div className="text-right">
                  <span className="text-stone-100 font-semibold block">{activeP2POrder.merchant.name}</span>
                  <span className="text-[10px] text-stone-400 font-mono">{activeP2POrder.merchant.legalName}</span>
                </div>
              </div>
              <div className="flex justify-between text-xs text-stone-400 pt-1 border-t border-white/5">
                <span>{activeP2POrder.artwork
                  ? (activeP2POrder.buyerId === user?.id ? 'Artwork to Receive' : 'Artwork for Sale')
                  : (activeP2POrder.buyerId === user?.id ? 'USDT to Receive' : 'USDT to Sell')}:</span>
                <span className="font-serif text-lg font-bold text-emerald-400 text-right">
                  {activeP2POrder.artwork ? activeP2POrder.artwork.title : `${activeP2POrder.cryptoAmount} USDT`}
                </span>
              </div>
              <div className="flex justify-between text-xs text-stone-400">
                <span>{activeP2POrder.buyerId === user?.id ? 'Fiat to Pay' : 'Fiat to Receive'}:</span>
                <span className="font-serif text-lg font-bold text-stone-100">
                  ${activeP2POrder.fiatAmount.toFixed(2)} {activeP2POrder.fiatCurrency}
                </span>
              </div>
            </div>

            {/* Payment Coordinates with Copy Buttons */}
            <div className="p-4 rounded-2xl bg-emerald-950/20 border border-emerald-500/20 space-y-3 text-xs">
              <div className="flex items-center justify-between text-emerald-300 font-semibold">
                <span>Payment Details ({formatPaymentMethodLabel(activeP2POrder.paymentMethod)})</span>
              </div>

              <div>
                <span className="text-[11px] text-stone-400 block mb-1">Recipient Account / Handle</span>
                <div className="flex items-center justify-between bg-black/40 p-2.5 rounded-xl border border-white/10 font-mono text-stone-200">
                  <span>{activeP2POrder.paymentDetails.accountNumberOrId}</span>
                  <button
                    onClick={() => {
                      navigator.clipboard?.writeText(activeP2POrder.paymentDetails.accountNumberOrId);
                      setCopiedAccount(true);
                      setTimeout(() => setCopiedAccount(false), 2000);
                    }}
                    className="text-stone-400 hover:text-white"
                  >
                    {copiedAccount ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>

              <div>
                <span className="text-[11px] text-stone-400 block mb-1">Mandatory Reference Code</span>
                <div className="flex items-center justify-between bg-black/40 p-2.5 rounded-xl border border-white/10 font-mono text-amber-300 font-bold">
                  <span>{activeP2POrder.paymentDetails.referenceCode}</span>
                  <button
                    onClick={() => {
                      navigator.clipboard?.writeText(activeP2POrder.paymentDetails.referenceCode);
                      setCopiedRef(true);
                      setTimeout(() => setCopiedRef(false), 2000);
                    }}
                    className="text-stone-400 hover:text-white"
                  >
                    {copiedRef ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>
            </div>

            {/* Live In-Trade Chat Drawer */}
            <div className="p-3.5 rounded-2xl bg-white/[0.02] border border-white/5 space-y-2">
              <button
                type="button"
                onClick={() => setChatOpen(!chatOpen)}
                className="w-full flex items-center justify-between text-xs text-stone-300 font-semibold"
              >
                <div className="flex items-center gap-2">
                  <MessageSquare className="w-3.5 h-3.5 text-amber-400" />
                  <span>Trade Chat with Merchant ({messages.length})</span>
                </div>
                <span className="text-[11px] text-amber-300">{chatOpen ? 'Hide' : 'Open'}</span>
              </button>

              {chatOpen && (
                <div className="space-y-2 pt-2 border-t border-white/5">
                  <div className="max-h-36 overflow-y-auto no-scrollbar space-y-1.5 p-1 text-[11px]">
                    {messages.map((m) => (
                      <div
                        key={m.id}
                        className={`p-2 rounded-xl leading-relaxed ${
                          m.sender === 'system'
                            ? 'bg-amber-950/20 text-amber-200 border border-amber-500/20 text-[10px]'
                            : m.sender === 'buyer'
                            ? 'bg-white/10 text-stone-100 ml-6 text-right'
                            : 'bg-emerald-950/30 text-emerald-200 mr-6 border border-emerald-500/20'
                        }`}
                      >
                        <span className="font-bold block text-[10px] opacity-75">{m.senderName}:</span>
                        <span>{m.text}</span>
                      </div>
                    ))}
                  </div>

                  <form onSubmit={handleSendMessage} className="flex gap-1.5 pt-1">
                    <input
                      type="text"
                      placeholder="Message merchant directly..."
                      value={chatInput}
                      onChange={(e) => setChatInput(e.target.value)}
                      className="flex-1 bg-white/5 border border-white/10 rounded-xl px-2.5 py-1.5 text-xs text-stone-200 focus:outline-none focus:border-amber-400/50"
                    />
                    <button
                      type="submit"
                      disabled={!chatInput.trim()}
                      className="px-3 py-1.5 bg-amber-400 text-stone-950 font-bold rounded-xl text-xs disabled:opacity-30"
                    >
                      <Send className="w-3 h-3" />
                    </button>
                  </form>
                </div>
              )}
            </div>

            {/* Stepper Actions */}
            {activeP2POrder.status === 'escrow_locked' && (
              <div className="space-y-2 pt-1">
                {activeP2POrder.buyerId === user?.id ? (
                  <div className="space-y-2">
                    <label className="block rounded-xl border border-white/10 bg-white/[0.03] p-3 cursor-pointer">
                      <span className="block text-xs font-semibold text-stone-200">Payment proof</span>
                      <span className="block text-[10px] text-stone-400 mt-1">Upload a receipt or screenshot so the seller can verify the payment.</span>
                      <input
                        type="file"
                        accept="image/jpeg,image/png,image/webp,application/pdf"
                        className="mt-2 block w-full text-[11px] text-stone-400"
                        onChange={(e) => setPaymentProof(e.target.files?.[0] || null)}
                      />
                    </label>
                    <button
                      disabled={!paymentProof || proofUploading}
                      onClick={async () => {
                        if (!paymentProof || !user) return;
                        setProofUploading(true);
                        try {
                          const safeName = paymentProof.name.replace(/[^a-zA-Z0-9._-]/g, '_');
                          const path = `${user.id}/${activeP2POrder.id}/${crypto.randomUUID()}-${safeName}`;
                          const upload = await supabase.storage.from('aura-p2p-proofs').upload(path, paymentProof, { contentType: paymentProof.type, upsert: false });
                          if (upload.error) throw upload.error;
                          const inserted = await supabase.from('p2p_payment_proofs').insert({
                            order_id: activeP2POrder.id,
                            uploader_id: user.id,
                            storage_path: path,
                            file_name: paymentProof.name,
                            mime_type: paymentProof.type,
                          }).select('id,storage_path,file_name,note,created_at').single();
                          if (inserted.error) throw inserted.error;
                          const signed = await supabase.storage.from('aura-p2p-proofs').createSignedUrl(path, 600);
                          setProofs((prev) => [...prev, { ...(inserted.data as any), url: signed.data?.signedUrl || undefined }]);
                          const marked = await markP2PPaymentSent(activeP2POrder.id);
                          if (!marked) throw new Error('Payment proof was uploaded, but the trade could not be marked as paid.');
                          setPaymentProof(null);
                        } catch (err: any) {
                          alert(err.message || 'Could not upload payment proof.');
                        } finally {
                          setProofUploading(false);
                        }
                      }}
                      className="w-full py-4 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-stone-950 font-bold text-xs transition-all shadow-lg shadow-emerald-500/20 active:scale-[0.98] disabled:opacity-40"
                    >
                      {proofUploading ? 'Uploading proof…' : 'I Have Paid — Send Proof'}
                    </button>
                  </div>
                ) : (
                  <div className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 text-center text-xs text-stone-400">
                    Waiting for the buyer to transfer ${activeP2POrder.fiatAmount.toFixed(2)} {activeP2POrder.fiatCurrency}.
                  </div>
                )}
                <button
                  onClick={() => cancelP2POrder(activeP2POrder.id)}
                  className="w-full py-2.5 text-stone-400 hover:text-stone-200 text-xs"
                >
                  Cancel Order
                </button>
              </div>
            )}

            {activeP2POrder.status === 'payment_marked' && (
              <div className="space-y-3 pt-1">
                <div className="p-3 rounded-xl bg-cyan-950/30 border border-cyan-500/20 text-xs text-cyan-300 text-center">
                  Payment marked by the buyer. {activeP2POrder.sellerId === user?.id
                    ? (activeP2POrder.artwork ? 'Release the artwork when you confirm receipt.' : 'Release the held USDT when you confirm receipt.')
                    : (activeP2POrder.artwork ? 'Waiting for the seller to release the artwork.' : 'Waiting for the seller to release the held USDT.')}
                </div>
                {proofs.length > 0 && (
                  <div className="rounded-xl border border-white/10 bg-black/20 p-3 space-y-2">
                    <div className="text-[10px] uppercase tracking-wider text-stone-400">Payment evidence</div>
                    {proofs.map((proof) => (
                      <div key={proof.id} className="flex items-center gap-2">
                        {proof.url && proof.mime_type?.startsWith('image/') ? (
                          <a href={proof.url} target="_blank" rel="noreferrer">
                            <img src={proof.url} alt="Payment proof" className="w-14 h-14 rounded-lg object-cover border border-white/10" />
                          </a>
                        ) : (
                          <a href={proof.url} target="_blank" rel="noreferrer" className="text-xs text-cyan-300 underline">{proof.file_name}</a>
                        )}
                        <div className="min-w-0">
                          <div className="text-xs text-stone-200 truncate">{proof.file_name}</div>
                          <div className="text-[10px] text-stone-500">{new Date(proof.created_at).toLocaleString()}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {activeP2POrder.sellerId === user?.id ? (
                  <button
                    onClick={async () => {
                      const completed = await completeP2POrder(activeP2POrder.id);
                      if (completed) onClose();
                    }}
                    className="w-full py-4 rounded-xl bg-gradient-to-r from-emerald-400 to-teal-400 text-stone-950 font-bold text-xs transition-all shadow-lg active:scale-[0.98]"
                  >
                    {activeP2POrder.artwork ? 'Release Artwork to Buyer' : 'Release Held USDT'}
                  </button>
                ) : (
                  <div className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 text-center text-xs text-stone-400">
                    {activeP2POrder.artwork ? 'Waiting for the seller to release the artwork after payment verification.' : 'Waiting for the seller to release the held USDT after payment verification.'}
                  </div>
                )}
                <button
                  type="button"
                  onClick={() => raiseP2PDispute(activeP2POrder.id)}
                  className="w-full py-2.5 rounded-xl border border-amber-500/20 bg-amber-500/5 text-amber-300 text-xs font-semibold"
                >
                  Report an issue / Open dispute
                </button>
              </div>
            )}
          </div>
        ) : (
          /* NEW ORDER FORM */
          <form onSubmit={handleStartTrade} className="space-y-4">
            {/* Merchant info */}
            <div className="flex items-center gap-3 p-3.5 rounded-2xl bg-white/[0.03] border border-white/5">
              <img
                src={currentOffer.merchant?.avatar}
                alt={currentOffer.merchant?.name}
                className="w-11 h-11 rounded-full object-cover border-2 border-emerald-500/40"
              />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-bold text-stone-100">
                    {currentOffer.merchant?.name}
                  </span>
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                </div>
                <span className="text-[10px] text-stone-400 block font-mono">
                  {currentOffer.merchant?.legalName}
                </span>
                <span className="text-[10px] text-emerald-400 font-mono">
                  {currentOffer.merchant?.ordersCompleted ? currentOffer.merchant.ordersCompleted + ' trades' : 'New trader'} · AURA Ledger Hold
                </span>
              </div>
            </div>

            {/* Amount input */}
            <div>
              <div className="flex justify-between text-xs text-stone-400 mb-1.5">
                <span>{isArtworkOffer ? 'Artwork' : 'USDT Amount'}</span>
                <span>Limits: ${currentOffer.minLimitFiat} - ${currentOffer.maxLimitFiat}</span>
              </div>
              <div className="relative">
                <input
                  type="number"
                  min={currentOffer.minLimitFiat / currentOffer.pricePerUnit}
                  max={currentOffer.maxLimitFiat / currentOffer.pricePerUnit}
                  step="any"
                  value={isArtworkOffer ? '1' : cryptoAmount}
                  onChange={(e) => setCryptoAmount(e.target.value)}
                  disabled={isArtworkOffer}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-stone-100 font-mono focus:outline-none focus:border-emerald-400/60"
                  required
                />
                <button
                  type="button"
                  onClick={() => setCryptoAmount('100')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] uppercase font-mono px-2 py-0.5 rounded bg-white/10 text-stone-300"
                >
                  $100
                </button>
              </div>
            </div>

            {!isArtworkOffer && currentOffer.type === 'buy' && (
              <div className="p-3.5 rounded-2xl bg-cyan-950/20 border border-cyan-500/20 space-y-2">
                <label className="text-xs text-cyan-200 font-medium block">
                  Your Fiat Receiving Account / Handle
                </label>
                <input
                  type="text"
                  value={receiveAccount}
                  onChange={(e) => setReceiveAccount(e.target.value)}
                  placeholder="Bank account, wallet handle, or payment ID"
                  className="w-full bg-black/30 border border-white/10 rounded-xl px-3 py-2.5 text-xs text-stone-100 focus:outline-none focus:border-cyan-400/60"
                  required
                />
                <p className="text-[10px] text-stone-500">
                  This is shown to the buyer so they know where to send the fiat payment.
                </p>
              </div>
            )}

            {/* Calculated Fiat */}
            <div className="p-3.5 rounded-2xl bg-white/[0.02] border border-white/5 flex items-center justify-between text-xs">
              <span className="text-stone-400">{isArtworkOffer ? 'Artwork Price' : (currentOffer.type === 'sell' ? 'Fiat You Pay' : 'Fiat You Receive')}:</span>
              <span className="font-serif text-xl font-bold text-stone-100 tabular-nums">
                ${fiatTotal.toFixed(2)} {currentOffer.fiatCurrency}
              </span>
            </div>

            {/* Payment Method Selector */}
            <div>
              <label className="text-xs text-stone-400 block mb-1.5 font-medium">
                Choose Payment Rail
              </label>
              <select
                value={selectedMethod}
                onChange={(e) => setSelectedMethod(e.target.value as PaymentMethodType)}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-xs text-stone-200 focus:outline-none focus:border-emerald-400/60"
              >
                {currentOffer.paymentMethods?.map((m) => (
                  <option key={m} value={m} className="bg-[#12121a]">
                    {formatPaymentMethodLabel(m)} (AURA Trade)
                  </option>
                ))}
              </select>

              {currentOffer.paymentInstructions && (
                <div className="mt-2 p-2.5 rounded-xl bg-white/[0.03] border border-white/5 text-[11px] text-stone-300">
                  <span className="text-[10px] font-mono text-amber-300 block uppercase mb-0.5">
                    Payment Instructions:
                  </span>
                  <p className="font-mono text-stone-300 leading-relaxed">
                    {currentOffer.paymentInstructions}
                  </p>
                </div>
              )}
            </div>

            {/* Trade state callout */}
            <div className="flex items-start gap-2 p-3 rounded-xl bg-emerald-950/20 border border-emerald-500/20 text-[11px] text-stone-300 leading-relaxed">
              <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              <span>
                {isArtworkOffer
                  ? 'AURA tracks the fiat order and transfers artwork ownership only after the seller confirms payment. Fiat is settled directly using the selected payment method.'
                  : 'The seller\'s USDT is reserved in the AURA internal ledger until completion or cancellation. Never send fiat outside the instructions shown in this order.'}
              </span>
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={numCrypto <= 0}
              className={`w-full py-4 rounded-xl font-bold text-xs transition-all shadow-lg active:scale-[0.98] ${
                currentOffer.type === 'sell'
                  ? 'bg-emerald-500 hover:bg-emerald-400 text-stone-950 shadow-emerald-500/20'
                  : 'bg-rose-500 hover:bg-rose-400 text-stone-100 shadow-rose-500/20'
              }`}
            >
              {isArtworkOffer ? 'Buy Artwork' : (currentOffer.type === 'sell' ? 'Buy USDT' : 'Sell USDT')}
            </button>
          </form>
        )}
      </div>
    </div>
  );
};
