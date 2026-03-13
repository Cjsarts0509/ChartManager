import React, { useState, useCallback, useEffect, useMemo } from "react";
import { toast, Toaster } from "sonner";
import { motion, AnimatePresence } from "motion/react";
import {
  Person24Regular,
  Call24Regular,
  Receipt24Regular,
  Send24Regular,
  Cart24Regular,
  ArrowRight24Regular,
  ArrowLeft24Regular,
  CreditCardPerson24Regular,
  CheckmarkCircle24Filled,
  Payment24Regular,
  BuildingBank24Regular,
  LockClosed24Regular,
  Copy24Regular,
  Location24Regular,
  Mail24Regular,
} from "@fluentui/react-icons";
import { GlassPanel } from "./components/GlassPanel";
import { type Product } from "./components/ProductCard";
import { ProductScrollSection } from "./components/ProductScrollSection";
import { StepIndicator } from "./components/StepIndicator";
import { AddressSearch } from "./components/AddressSearch";
import { PinInput } from "./components/PinInput";
import { MainPage } from "./components/MainPage";
import { OrderLookup } from "./components/OrderLookup";
import { AdminLogin } from "./components/AdminLogin";
import { AdminProductManagement } from "./components/AdminProductManagement";
import { CardPaymentModal } from "./components/CardPaymentModal";
import { MobileProductTabs } from "./components/MobileProductTabs";
import { formatPhone, formatBizNumber } from "./utils/phoneFormat";
import { createOrderData, type OrderData } from "./utils/orderUtils";
import {
  getProducts,
  getResolvedSets,
  getOrders,
  addOrder,
  getBookImageUrl,
  getProductsSync,
  getResolvedSetsSync,
  getOrdersSync,
  type RegisteredProduct,
  type ResolvedSetProduct,
} from "./utils/dataStore";
import { projectId, publicAnonKey } from "/utils/supabase/info";
import { useIsMobile } from "./utils/useIsMobile";
import { calculateTotalPrice, formatWon } from "./utils/priceCalculator";

const TOTAL_STEPS = 4;
const BANK_INFO = {
  bank: "국민은행",
  account: "012-345-6789-012",
  holder: "(주)교보문고",
};

type AppView = "main" | "order" | "lookup" | "admin" | "adminProducts";
type QuantityMap = Record<string, number>;

/** 등록된 상품(단품+세트)을 Product[] 형태로 변환 */
function buildProductList(
  products: RegisteredProduct[],
  sets: ResolvedSetProduct[]
): Product[] {
  const singles: Product[] = products.map((p) => ({
    id: p.id,
    isbn: p.isbn,
    name: p.name,
    publisher: p.publisher,
    listPrice: p.listPrice,
    imageUrl: getBookImageUrl(p.isbn),
    type: "single" as const,
  }));
  const setProducts: Product[] = sets.map((s) => ({
    id: s.id,
    isbn: s.items[0]?.isbn || "",
    name: s.name,
    publisher: s.items.map((i) => i.publisher).filter((v, i, a) => a.indexOf(v) === i).join(", "),
    listPrice: s.listPrice,
    imageUrl: s.items[0] ? getBookImageUrl(s.items[0].isbn) : "",
    type: "set" as const,
    setItems: s.items.map((i) => i.name),
    setItemDetails: s.items.map((i) => ({
      isbn: i.isbn,
      name: i.name,
      publisher: i.publisher,
      listPrice: i.listPrice,
    })),
  }));
  return [...setProducts, ...singles];
}

export default function App() {
  /* ── 뷰 ── */
  const [view, setView] = useState<AppView>("main");
  const [viewDirection, setViewDirection] = useState(1);
  const isMobile = useIsMobile();

  /* ── 주문 폼 ── */
  const [step, setStep] = useState(0);
  const [direction, setDirection] = useState(1);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [address, setAddress] = useState("");
  const [zipCode, setZipCode] = useState("");
  const [addressDetail, setAddressDetail] = useState("");
  const [quantities, setQuantities] = useState<QuantityMap>({});
  const [paymentMethod, setPaymentMethod] = useState<"card" | "bank">("card");
  const [receiptType, setReceiptType] = useState<"none" | "personal" | "business">("none");
  const [receiptNumber, setReceiptNumber] = useState("");
  const [pin, setPin] = useState("");
  const [orderResult, setOrderResult] = useState<OrderData | null>(null);
  const [showCardPayment, setShowCardPayment] = useState(false);

  /* ── 상품 목록 ── */
  const [productList, setProductList] = useState<Product[]>(() => {
    const prods = getProductsSync();
    const sets = getResolvedSetsSync();
    return buildProductList(prods, sets);
  });
  const [allOrders, setAllOrders] = useState<OrderData[]>(() => getOrdersSync());
  const [dataVersion, setDataVersion] = useState(0);
  const [isLoading, setIsLoading] = useState(false);

  const reloadData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [prods, sets, orders] = await Promise.all([
        getProducts(),
        getResolvedSets(),
        getOrders(),
      ]);
      setProductList(buildProductList(prods, sets));
      setAllOrders(orders);
    } catch (e) {
      console.error("[App] reloadData error:", e);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    reloadData();
  }, [reloadData, dataVersion]);

  /* ── 파생 데이터 ── */
  const selectedProductData = useMemo(
    () => productList.filter((p) => (quantities[p.id] || 0) > 0),
    [productList, quantities]
  );
  const selectedCount = selectedProductData.length;
  const totalQuantity = selectedProductData.reduce((s, p) => s + (quantities[p.id] || 0), 0);
  
  // 새로운 가격 계산 방식 적용
  const totalPrices = useMemo(() => {
    return calculateTotalPrice(
      selectedProductData.map((p) => ({
        listPrice: p.listPrice,
        quantity: quantities[p.id] || 0,
      }))
    );
  }, [selectedProductData, quantities]);

  /* ── 핸들러 ── */
  const handleQuantityChange = useCallback((id: string, qty: number) => {
    setQuantities((prev) => {
      const next = { ...prev };
      if (qty <= 0) { delete next[id]; } else { next[id] = qty; }
      return next;
    });
  }, []);

  const handlePhoneChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setPhone(formatPhone(e.target.value));
  }, []);

  const handleReceiptPhoneChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setReceiptNumber(formatPhone(e.target.value));
    },
    []
  );

  const navigateTo = (v: AppView) => {
    setViewDirection(1);
    setView(v);
    if (v === "order") {
      reloadData();
      setStep(0);
      setDirection(1);
      setName(""); setPhone(""); setEmail("");
      setAddress(""); setZipCode(""); setAddressDetail("");
      setQuantities({});
      setPaymentMethod("card");
      setReceiptType("none"); setReceiptNumber("");
      setPin(""); setOrderResult(null);
    }
  };

  const goBack = () => { setViewDirection(-1); setView("main"); };

  const goNext = () => {
    if (step === 0) {
      if (!name.trim()) { toast.error("이름을 입력해 주세요."); return; }
      if (phone.replace(/\D/g, "").length < 10) { toast.error("전화번호를 정확히 입력해 주세요."); return; }
      if (!address) { toast.error("배송 주소를 검색해 주세요."); return; }
    }
    if (step === 1 && selectedCount === 0) {
      toast.error("최소 1개의 상품을 선택해 주세요."); return;
    }
    if (step === 2 && paymentMethod === "bank") {
      if (receiptType === "personal" && receiptNumber.replace(/\D/g, "").length < 10) {
        toast.error("현금영수증용 휴대폰 번호를 정확히 입력해 주세요."); return;
      }
      if (receiptType === "business" && receiptNumber.replace(/\D/g, "").length < 10) {
        toast.error("사업자등록번호를 정확히 입력해 주세요."); return;
      }
    }
    setDirection(1);
    setStep((s) => Math.min(s + 1, TOTAL_STEPS - 1));
  };

  const goPrev = () => {
    if (step === 0) { goBack(); return; }
    setDirection(-1);
    setStep((s) => Math.max(s - 1, 0));
  };

  const finalizeOrder = async () => {
    const orderProducts = selectedProductData.map((p) => ({
      id: p.id, isbn: p.isbn, name: p.name, publisher: p.publisher,
      listPrice: p.listPrice, imageUrl: p.imageUrl,
      type: p.type, setItems: p.setItems,
      quantity: quantities[p.id] || 1,
    }));
    const order = createOrderData({
      customerName: name, customerPhone: phone, zipCode,
      shippingAddress: address, shippingAddressDetail: addressDetail,
      products: orderProducts, paymentMethod,
      receiptType: paymentMethod === "bank" ? receiptType : undefined,
      receiptNumber: paymentMethod === "bank" ? receiptNumber : undefined,
      pin,
    });
    setOrderResult(order);
    try {
      const updatedOrders = await addOrder(order);
      setAllOrders(updatedOrders);
    } catch (e) {
      console.error("[App] finalizeOrder addOrder error:", e);
    }

    // 이메일 주문 확인 발송
    if (email.trim()) {
      try {
        const emailRes = await fetch(
          `https://${projectId}.supabase.co/functions/v1/make-server-81c2c616/send-order-email`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${publicAnonKey}` },
            body: JSON.stringify({ email, order }),
          }
        );
        const emailResult = await emailRes.json();
        if (!emailRes.ok || !emailResult.ok) {
          console.warn("[App] order email send response:", emailResult);
          const reason = emailResult.reason || emailResult.error || "알 수 없는 오류";
          if (reason.includes("not configured")) {
            toast.info("이메일 발송 불가: RESEND_API_KEY가 설정되지 않았습니다.");
          } else if (reason.includes("only send testing emails") || reason.includes("verify a domain")) {
            toast.info("테스트 모드에서는 계정 이메일(4rumarts@gmail.com)로만 발송 가능합니다. 다른 수신자에게 보내려면 Resend에서 도메인 인증이 필요합니다.", { duration: 6000 });
          } else if (reason.includes("403") || reason.includes("validation_error")) {
            toast.info("이메일 발송 권한 오류: Resend 도메인 인증을 확인해 주세요.", { duration: 5000 });
          } else {
            toast.info(`이메일 발송 실패: ${reason}`);
          }
        } else {
          console.log("[App] order email sent:", emailResult);
          toast.success("주문 확인 메일이 발송되었습니다.");
        }
      } catch (e) {
        console.warn("[App] order email send failed (non-critical):", e);
      }
    }

    toast.success(`주문이 접수되었습니다! (${order.orderNumber})`);
    setDirection(1);
    setStep(TOTAL_STEPS);
  };

  const handleSubmit = () => {
    const missing: string[] = [];
    if (!name.trim()) missing.push("이름");
    if (phone.replace(/\D/g, "").length < 10) missing.push("전화번호");
    if (!address) missing.push("배송 주소");
    if (selectedCount === 0) missing.push("상품 선택 (최소 1개)");
    if (paymentMethod === "bank" && receiptType === "personal" && receiptNumber.replace(/\D/g, "").length < 10) missing.push("현금영수증 휴대폰 번호");
    if (paymentMethod === "bank" && receiptType === "business" && receiptNumber.replace(/\D/g, "").length < 10) missing.push("사업자등록번호");
    if (pin.length < 4) missing.push("비밀번호 4자리");

    if (missing.length > 0) {
      toast.error(
        <div className="text-left">
          <p className="mb-1">아래 필수 정보를 입력해 주세요:</p>
          <ul className="list-disc pl-4 space-y-0.5">
            {missing.map((m) => (<li key={m}>{m}</li>))}
          </ul>
        </div>,
        { duration: 5000 }
      );
      return;
    }
    if (paymentMethod === "card") {
      setShowCardPayment(true);
    } else {
      finalizeOrder();
    }
  };

  const handleStepClick = (targetStep: number) => {
    if (targetStep === step) return;
    setDirection(targetStep > step ? 1 : -1);
    setStep(targetStep);
  };

  /* ── 애니메이션 ── */
  const viewVariants = {
    enter: (d: number) => ({ x: d > 0 ? 100 : -100, opacity: 0, scale: 0.95 }),
    center: { x: 0, opacity: 1, scale: 1 },
    exit: (d: number) => ({ x: d > 0 ? -100 : 100, opacity: 0, scale: 0.95 }),
  };

  // 모바일: 화면 전환 느낌으로 더 큰 슬라이드 오프셋
  const stepVariants = isMobile
    ? {
        enter: (d: number) => ({ x: d > 0 ? "100%" : "-100%", opacity: 0 }),
        center: { x: 0, opacity: 1 },
        exit: (d: number) => ({ x: d > 0 ? "-100%" : "100%", opacity: 0 }),
      }
    : {
        enter: (d: number) => ({ x: d > 0 ? 50 : -50, opacity: 0 }),
        center: { x: 0, opacity: 1 },
        exit: (d: number) => ({ x: d > 0 ? -50 : 50, opacity: 0 }),
      };
  const springTransition = { type: "spring" as const, damping: 30, stiffness: 260, mass: 0.8 };

  /* ── 주문서 단계 렌더 ── */
  const renderStep = () => {
    switch (step) {
      case 0:
        return (
          <div className="space-y-5">
            <div className="flex items-center gap-2 mb-2">
              <Person24Regular className="text-indigo-600" />
              <h3 className="text-gray-900">고객 정보</h3>
            </div>
            <div>
              <label className="block text-gray-700 text-[13px] font-semibold mb-1.5">수신인 이름 <span className="text-red-500">*</span></label>
              <div className="relative">
                <Person24Regular className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 w-5 h-5" />
                <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="홍길동"
                  className="w-full rounded-xl border border-gray-200 bg-white/80 backdrop-blur-sm py-2.5 pl-10 pr-4 text-gray-900 placeholder:text-gray-400 outline-none transition-all focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/25" />
              </div>
            </div>
            <div>
              <label className="block text-gray-700 text-[13px] font-semibold mb-1.5">연락처 <span className="text-red-500">*</span></label>
              <div className="relative">
                <Call24Regular className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 w-5 h-5" />
                <input type="tel" value={phone} onChange={handlePhoneChange} placeholder="010-1234-5678"
                  className="w-full rounded-xl border border-gray-200 bg-white/80 backdrop-blur-sm py-2.5 pl-10 pr-4 text-gray-900 placeholder:text-gray-400 outline-none transition-all focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/25" />
              </div>
            </div>
            <div>
              <label className="block text-gray-700 text-[13px] font-semibold mb-1.5">이메일 <span className="text-gray-400 text-[11px] font-normal">(선택 — 입력 시 주문 확인 메일 발송)</span></label>
              <div className="relative">
                <Mail24Regular className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 w-5 h-5" />
                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="example@email.com"
                  className="w-full rounded-xl border border-gray-200 bg-white/80 backdrop-blur-sm py-2.5 pl-10 pr-4 text-gray-900 placeholder:text-gray-400 outline-none transition-all focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/25" />
              </div>
            </div>
            <div>
              <label className="block text-gray-700 text-[13px] font-semibold mb-1.5">배송 주소 <span className="text-red-500">*</span></label>
              <AddressSearch value={address ? `[${zipCode}] ${address}` : ""} onChange={(addr, zip) => { setAddress(addr); setZipCode(zip); }} />
            </div>
            <AnimatePresence>
              {address && (
                <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={springTransition}>
                  <div className="mb-4">
                    <label className="block text-gray-700 text-[13px] font-semibold mb-1.5">우편번호</label>
                    <div className="relative">
                      <Location24Regular className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 w-5 h-5" />
                      <input type="text" value={zipCode} readOnly className="w-full rounded-xl border border-gray-200 bg-gray-50 backdrop-blur-sm py-2.5 pl-10 pr-4 text-gray-600 outline-none cursor-default" />
                    </div>
                  </div>
                  <label className="block text-gray-700 text-[13px] font-semibold mb-1.5">상세 주소</label>
                  <input type="text" value={addressDetail} onChange={(e) => setAddressDetail(e.target.value)} placeholder="동/호수, 층, 건물명 등"
                    className="w-full rounded-xl border border-gray-200 bg-white/80 backdrop-blur-sm py-2.5 px-4 text-gray-900 placeholder:text-gray-400 outline-none transition-all focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/25" />
                </motion.div>
              )}
            </AnimatePresence>
            <div className="rounded-xl border border-indigo-300 bg-indigo-50 backdrop-blur-sm p-3">
              <p className="text-indigo-700 text-[11px] font-medium">
                * 배송은 우체국 택배(기업계약)를 통해 발송됩니다. 정확한 주소와 연락처를 입력해 주세요.
              </p>
            </div>
          </div>
        );

      case 1:
        // 상품을 세트와 단품으로 분리
        const setProducts = productList.filter((p) => p.type === "set");
        const singleProducts = productList.filter((p) => p.type === "single");
        
        return (
          <div className="flex flex-col h-full" style={{ minHeight: '400px', maxHeight: '700px' }}>
            {productList.length === 0 ? (
              <div className="text-center py-12 text-gray-400 text-[14px]">
                <Cart24Regular className="w-10 h-10 text-gray-300 mx-auto mb-3" />
                <p>등록된 상품이 없습니다.</p>
                <p className="text-[12px] mt-1">관리자가 상품을 먼저 등록해 주세요.</p>
              </div>
            ) : (
              <>
                {isMobile ? (
                  /* ── 모바일: 탭 전환 방식 ── */
                  <div className="flex-1 min-h-0">
                    <MobileProductTabs
                      setProducts={setProducts}
                      singleProducts={singleProducts}
                      quantities={quantities}
                      onQuantityChange={handleQuantityChange}
                    />
                  </div>
                ) : (
                  /* ── 데스크탑: 2열 레이아웃 — 각 열 독립 스크롤 ── */
                  <div className="flex-1 min-h-0 grid grid-cols-2 gap-3">
                    <ProductScrollSection
                      title="세트 상품"
                      icon="set"
                      products={setProducts}
                      quantities={quantities}
                      onQuantityChange={handleQuantityChange}
                    />
                    <ProductScrollSection
                      title="단품 상품"
                      icon="single"
                      products={singleProducts}
                      quantities={quantities}
                      onQuantityChange={handleQuantityChange}
                    />
                  </div>
                )}
                
                {/* 판매가 계산 영역 — 콤팩트, 항상 하단 고정 */}
                <div className="shrink-0 mt-2 rounded-lg bg-gradient-to-r from-indigo-500 to-purple-600 px-3 sm:px-4 py-2 sm:py-2.5 text-white shadow-lg">
                  <div className="flex items-center justify-between text-[11px] sm:text-[12px]">
                    <div className="flex items-center gap-2">
                      <span>선택 <span className="font-semibold">{selectedCount}종</span></span>
                      <span className="text-white/30">|</span>
                      <span>수량 <span className="font-semibold">{totalQuantity}개</span></span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-white/60 line-through text-[10px] sm:text-[11px]">{formatWon(totalPrices.listPrice)}</span>
                      <span className="text-yellow-200 text-[10px] sm:text-[11px]">-{formatWon(totalPrices.discountAmount)}</span>
                      <span className="text-emerald-200 text-[10px] sm:text-[11px]">지원-{formatWon(totalPrices.schoolSupport)}</span>
                    </div>
                  </div>
                  <div className="flex items-center justify-between mt-1 pt-1 border-t border-white/20">
                    <span className="font-bold text-[12px] sm:text-[13px]">최종 판매가</span>
                    <span className="font-bold text-[16px] sm:text-[18px]">{formatWon(totalPrices.finalPrice)}</span>
                  </div>
                </div>
              </>
            )}
          </div>
        );

      case 2:
        return (
          <div className="space-y-5">
            <div className="flex items-center gap-2 mb-2">
              <CreditCardPerson24Regular className="text-indigo-600" />
              <h3 className="text-gray-900">결제 정보</h3>
            </div>

            {/* 데스크톱 2컬럼: 결제수단(좌) + 현금영수증/금액(우) — 계좌이체 선택 시 */}
            <div className={`${!isMobile && paymentMethod === "bank" ? "grid grid-cols-2 gap-5 items-start" : ""}`}>
              {/* 좌측: 결제 수단 */}
              <div className="space-y-4">
                <div>
                  <label className="block text-gray-700 text-[13px] font-semibold mb-3">결제 수단</label>
                  <div className="grid grid-cols-2 gap-3">
                    <button type="button" onClick={() => setPaymentMethod("card")}
                      className={`flex flex-col items-center gap-2 rounded-xl border-2 py-4 px-3 transition-all duration-200 cursor-pointer ${
                        paymentMethod === "card" ? "border-indigo-600 bg-indigo-600 text-white shadow-[0_4px_16px_rgba(79,70,229,0.3)]" : "border-gray-200 bg-white text-gray-500 hover:bg-gray-50"
                      }`}>
                      <Payment24Regular className="w-6 h-6" /><span className="text-[14px]">카드 결제</span>
                    </button>
                    <button type="button" onClick={() => setPaymentMethod("bank")}
                      className={`flex flex-col items-center gap-2 rounded-xl border-2 py-4 px-3 transition-all duration-200 cursor-pointer ${
                        paymentMethod === "bank" ? "border-indigo-600 bg-indigo-600 text-white shadow-[0_4px_16px_rgba(79,70,229,0.3)]" : "border-gray-200 bg-white text-gray-500 hover:bg-gray-50"
                      }`}>
                      <BuildingBank24Regular className="w-6 h-6" /><span className="text-[14px]">계좌 이체</span>
                    </button>
                  </div>
                </div>

                {/* 카드 결제 시: 결제금액 좌측에 표시 */}
                {paymentMethod === "card" && (
                  <div className="rounded-xl border border-white/40 bg-white/20 backdrop-blur-sm p-4 space-y-1">
                    <div className="flex justify-between text-[13px]">
                      <span className="text-gray-500">정가 합계</span>
                      <span className="text-gray-500 line-through">{formatWon(totalPrices.listPrice)}</span>
                    </div>
                    <div className="flex justify-between text-[13px]">
                      <span className="text-gray-500">할인</span>
                      <span className="text-red-500">-{formatWon(totalPrices.discountAmount)}</span>
                    </div>
                    <div className="flex justify-between text-[13px]">
                      <span className="text-gray-500">학원지원금</span>
                      <span className="text-emerald-600">-{formatWon(totalPrices.schoolSupport)}</span>
                    </div>
                    <div className="flex justify-between pt-2 border-t border-white/30">
                      <span className="text-gray-700">결제 금액</span>
                      <span className="text-indigo-600 font-medium">{formatWon(totalPrices.finalPrice)}</span>
                    </div>
                  </div>
                )}

                {/* 계좌이체 — 계좌 정보 (좌측) */}
                <AnimatePresence mode="wait">
                  {paymentMethod === "bank" && (
                    <motion.div key="bank-account" initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }} transition={springTransition} className="overflow-hidden">
                      <div className="rounded-xl border border-indigo-200/40 bg-indigo-50/30 backdrop-blur-sm p-4 text-center space-y-1.5">
                        <BuildingBank24Regular className="w-6 h-6 text-indigo-500 mx-auto" />
                        <p className="text-indigo-600">{BANK_INFO.bank}</p>
                        <button type="button" onClick={() => {
                          const text = BANK_INFO.account.replace(/-/g, "");
                          const ta = document.createElement("textarea"); ta.value = text; ta.style.position = "fixed"; ta.style.opacity = "0";
                          document.body.appendChild(ta); ta.select();
                          try { document.execCommand("copy"); toast.success("계좌번호가 복사되었습니다."); } catch { toast.info(`계좌번호: ${text}`); }
                          document.body.removeChild(ta);
                        }} className="inline-flex items-center gap-1.5 text-gray-700 font-mono tracking-wider text-[16px] hover:text-indigo-600 transition-colors cursor-pointer">
                          {BANK_INFO.account}
                          <Copy24Regular className="w-4 h-4 text-gray-400" />
                        </button>
                        <p className="text-gray-500 text-[13px]">예금주: {BANK_INFO.holder}</p>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* 우측: 현금영수증 + 결제금액 (계좌이체 시) */}
              <AnimatePresence mode="wait">
                {paymentMethod === "bank" && (
                  <motion.div key="bank-right" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 20 }} transition={springTransition} className="space-y-4">
                    <div className="space-y-3">
                      <label className="block text-gray-700 text-[13px] font-semibold mb-2">현금영수증 유형</label>
                      <div className="space-y-2">
                        <button type="button" onClick={() => { if (receiptType !== "none") { setReceiptType("none"); setReceiptNumber(""); } }}
                          className={`w-full flex items-center justify-center gap-2 rounded-xl border-2 py-2.5 px-3 transition-all duration-200 cursor-pointer ${
                            receiptType === "none" ? "border-indigo-600 bg-indigo-600 text-white" : "border-gray-200 bg-white text-gray-500 hover:bg-gray-50"
                          }`}>
                          <span className={`w-3.5 h-3.5 rounded-full border-2 flex items-center justify-center shrink-0 ${receiptType === "none" ? "border-white" : "border-gray-300"}`}>
                            {receiptType === "none" && <span className="w-1.5 h-1.5 rounded-full bg-white" />}
                          </span>
                          <span className="text-[13px]">미발급</span>
                        </button>
                        <div className="grid grid-cols-2 gap-3">
                          {([
                            { value: "personal" as const, label: "개인 (소득공제)" },
                            { value: "business" as const, label: "사업자 (지출증빙)" },
                          ]).map((opt) => (
                            <button key={opt.value} type="button"
                              onClick={() => { if (receiptType !== opt.value) { setReceiptType(opt.value); setReceiptNumber(""); } }}
                              className={`flex items-center justify-center gap-2 rounded-xl border-2 py-2.5 px-3 transition-all duration-200 cursor-pointer ${
                                receiptType === opt.value ? "border-indigo-600 bg-indigo-600 text-white" : "border-gray-200 bg-white text-gray-500 hover:bg-gray-50"
                              }`}>
                              <span className={`w-3.5 h-3.5 rounded-full border-2 flex items-center justify-center shrink-0 ${receiptType === opt.value ? "border-white" : "border-gray-300"}`}>
                                {receiptType === opt.value && <span className="w-1.5 h-1.5 rounded-full bg-white" />}
                              </span>
                              <span className="text-[13px]">{opt.label}</span>
                            </button>
                          ))}
                        </div>
                      </div>
                      {receiptType !== "none" && (
                        <div>
                          <label className="block text-gray-700 text-[13px] font-semibold mb-1.5">
                            {receiptType === "personal" ? "휴대폰 번호" : "사업자등록번호"}
                          </label>
                          <div className="relative">
                            <Receipt24Regular className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 w-5 h-5" />
                            {receiptType === "personal" ? (
                              <input type="tel" value={receiptNumber} onChange={handleReceiptPhoneChange} placeholder="010-0000-0000"
                                className="w-full rounded-xl border border-gray-200 bg-white/80 backdrop-blur-sm py-2.5 pl-10 pr-4 text-gray-900 placeholder:text-gray-400 outline-none transition-all focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/25" />
                            ) : (
                              <input type="text" value={receiptNumber} onChange={(e) => setReceiptNumber(formatBizNumber(e.target.value))} placeholder="000-00-00000"
                                className="w-full rounded-xl border border-gray-200 bg-white/80 backdrop-blur-sm py-2.5 pl-10 pr-4 text-gray-900 placeholder:text-gray-400 outline-none transition-all focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/25" />
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                    <div className="rounded-xl border border-white/40 bg-white/20 backdrop-blur-sm p-4 space-y-1">
                      <div className="flex justify-between text-[13px]">
                        <span className="text-gray-500">정가 합계</span>
                        <span className="text-gray-500 line-through">{formatWon(totalPrices.listPrice)}</span>
                      </div>
                      <div className="flex justify-between text-[13px]">
                        <span className="text-gray-500">할인</span>
                        <span className="text-red-500">-{formatWon(totalPrices.discountAmount)}</span>
                      </div>
                      <div className="flex justify-between text-[13px]">
                        <span className="text-gray-500">학원지원금</span>
                        <span className="text-emerald-600">-{formatWon(totalPrices.schoolSupport)}</span>
                      </div>
                      <div className="flex justify-between pt-2 border-t border-white/30">
                        <span className="text-gray-700">결제 금액</span>
                        <span className="text-indigo-600 font-medium">{formatWon(totalPrices.finalPrice)}</span>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        );

      case 3: {
        const MAX_VISIBLE_PRODUCTS = 4;
        const visibleProducts = selectedProductData.slice(0, MAX_VISIBLE_PRODUCTS);
        const hiddenCount = selectedProductData.length - MAX_VISIBLE_PRODUCTS;
        const hiddenTotalPrice = hiddenCount > 0
          ? selectedProductData.slice(MAX_VISIBLE_PRODUCTS).reduce((sum, p) => sum + p.listPrice * (quantities[p.id] || 1), 0)
          : 0;

        return (
          <div className="space-y-5">
            <div className="flex items-center gap-2 mb-2">
              <CheckmarkCircle24Filled className="text-emerald-600 w-6 h-6" />
              <h3 className="text-gray-900">주문 확인</h3>
            </div>

            <div className={`${!isMobile ? "grid grid-cols-2 gap-5 items-stretch" : "space-y-5"}`}>
              {/* 좌측: 수신인 ~ 총 수량 */}
              <div className="rounded-xl border border-gray-200 bg-gray-50/80 backdrop-blur-sm overflow-hidden flex flex-col">
                <table className="w-full text-[13px]">
                  <tbody>
                    <tr className="border-b border-gray-100">
                      <td className="px-4 py-2.5 text-gray-500 font-medium whitespace-nowrap w-[90px]">수신인</td>
                      <td className="px-4 py-2.5 text-gray-800 font-medium">{name || <span className="text-red-500 font-medium">미입력</span>}</td>
                    </tr>
                    <tr className="border-b border-gray-100">
                      <td className="px-4 py-2.5 text-gray-500 font-medium whitespace-nowrap">연락처</td>
                      <td className="px-4 py-2.5 text-gray-800 font-medium">{phone || <span className="text-red-500 font-medium">미입력</span>}</td>
                    </tr>
                    {email && (
                      <tr className="border-b border-white/30">
                        <td className="px-4 py-2.5 text-gray-400 whitespace-nowrap">이메일</td>
                        <td className="px-4 py-2.5 text-gray-700">{email}</td>
                      </tr>
                    )}
                    <tr>
                      <td className="px-4 py-2.5 text-gray-400 whitespace-nowrap align-top">배송주소</td>
                      <td className="px-4 py-2.5 text-gray-700">
                        {address ? (<>[{zipCode}] {address}{addressDetail && <><br />{addressDetail}</>}</>) : <span className="text-red-500">미입력</span>}
                      </td>
                    </tr>
                  </tbody>
                </table>
                {/* 선택 상품 — flex-1로 남은 공간 채움 */}
                <div className="flex-1 flex flex-col border-t border-white/30 bg-white/10">
                  <div className="flex-1 px-4 py-2.5">
                    <p className="text-gray-400 text-[12px] mb-2">선택 상품</p>
                    {selectedProductData.length > 0 ? (
                      <div className="space-y-1.5">
                        {visibleProducts.map((p) => (
                          <div key={p.id} className="flex items-center gap-2">
                            <span className="text-gray-600 text-[13px] truncate min-w-0 flex-1">{p.name} <span className="text-gray-400">x{quantities[p.id] || 1}</span></span>
                            <span className="text-indigo-600 text-[13px] shrink-0 whitespace-nowrap">{formatWon(p.listPrice * (quantities[p.id] || 1))}</span>
                          </div>
                        ))}
                        {hiddenCount > 0 && (
                          <div className="flex items-center gap-2 pt-0.5">
                            <span className="text-gray-400 text-[12px] italic">...외 {hiddenCount}종</span>
                            <span className="text-indigo-500/70 text-[12px] shrink-0 whitespace-nowrap ml-auto">{formatWon(hiddenTotalPrice)}</span>
                          </div>
                        )}
                      </div>
                    ) : <span className="text-red-500 text-[13px]">미선택</span>}
                  </div>
                </div>
                {/* 총 수량 — 하단 고정 */}
                <div className="border-t border-white/30 mt-auto bg-white/10">
                  <div className="flex items-center px-4 py-2.5 text-[13px]">
                    <span className="text-gray-400 w-[90px] shrink-0">총 수량</span>
                    <span className="text-gray-700 font-medium">{selectedCount}종 / {totalQuantity}개</span>
                  </div>
                </div>
              </div>

              {/* 우측: 결제 금액 ~ 비밀번호 */}
              <div className="flex flex-col gap-4">
                <div className="rounded-xl border border-white/40 bg-white/20 backdrop-blur-sm overflow-hidden flex-1">
                  <table className="w-full text-[13px]">
                    <tbody>
                      <tr className="border-b border-white/30">
                        <td className="px-4 py-2.5 text-gray-400 whitespace-nowrap w-[90px]">결제 금액</td>
                        <td className="px-4 py-2.5 text-indigo-600 font-semibold text-[15px]">{formatWon(totalPrices.finalPrice)}</td>
                      </tr>
                      <tr className="border-b border-white/30">
                        <td className="px-4 py-2.5 text-gray-400 whitespace-nowrap">결제 수단</td>
                        <td className="px-4 py-2.5 text-gray-700">{paymentMethod === "card" ? "카드 결제" : "계좌 이체"}</td>
                      </tr>
                      {paymentMethod === "bank" && (
                        <>
                          <tr className="border-b border-white/30">
                            <td className="px-4 py-2.5 text-gray-400 whitespace-nowrap">입금 계좌</td>
                            <td className="px-4 py-2.5 text-gray-700">{BANK_INFO.bank} {BANK_INFO.account}</td>
                          </tr>
                          <tr className="border-b border-white/30">
                            <td className="px-4 py-2.5 text-gray-400 whitespace-nowrap">현금영수증</td>
                            <td className="px-4 py-2.5 text-gray-700">
                              {receiptType === "none" && "미발급"}
                              {receiptType === "personal" && `개인 (소득공제) / ${receiptNumber || "미입력"}`}
                              {receiptType === "business" && `사업자 (지출증빙) / ${receiptNumber || "미입력"}`}
                            </td>
                          </tr>
                        </>
                      )}
                      <tr className="border-b border-white/30">
                        <td className="px-4 py-2.5 text-gray-400 whitespace-nowrap">정가 합계</td>
                        <td className="px-4 py-2.5 text-gray-500 line-through">{formatWon(totalPrices.listPrice)}</td>
                      </tr>
                      <tr className="border-b border-white/30">
                        <td className="px-4 py-2.5 text-gray-400 whitespace-nowrap">할인</td>
                        <td className="px-4 py-2.5 text-red-500">-{formatWon(totalPrices.discountAmount)}</td>
                      </tr>
                      <tr>
                        <td className="px-4 py-2.5 text-gray-400 whitespace-nowrap">학원지원금</td>
                        <td className="px-4 py-2.5 text-emerald-600">-{formatWon(totalPrices.schoolSupport)}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
                <div className="rounded-xl border border-indigo-200/40 bg-indigo-50/30 backdrop-blur-sm p-4">
                  <div className="flex items-center gap-2 mb-3 justify-center">
                    <LockClosed24Regular className="text-indigo-500 w-5 h-5" />
                    <p className="text-gray-700 text-[14px]">주문 조회용 비밀번호 (숫자 4자리)</p>
                  </div>
                  <PinInput value={pin} onChange={setPin} />
                  <p className="text-gray-400 text-[11px] text-center mt-2">
                    전화번호 + 비밀번호로 주문 조회 및 취소가 가능합니다.
                  </p>
                </div>
              </div>
            </div>
          </div>
        );
      }

      case TOTAL_STEPS:
        return (
          <div className="text-center py-4 space-y-5">
            <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }}
              transition={{ type: "spring", damping: 15, stiffness: 300, delay: 0.1 }}
              className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-emerald-100/60">
              <CheckmarkCircle24Filled className="text-emerald-500 w-10 h-10" />
            </motion.div>
            <div>
              <h3 className="text-gray-800 mb-1">주문이 접수되었습니다!</h3>
              <p className="text-gray-500 text-[14px]">아래 주문번호를 확인해 주세요.</p>
            </div>
            {orderResult && (
              <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.25, ...springTransition }}
                className="rounded-xl border border-emerald-200/60 bg-emerald-50/30 backdrop-blur-sm p-4 space-y-2 text-left">
                <div className="flex justify-between text-[14px]"><span className="text-gray-500">주문번호</span><span className="text-gray-800 font-mono">{orderResult.orderNumber}</span></div>
                <div className="flex justify-between text-[14px]"><span className="text-gray-500">주문자</span><span className="text-gray-700">{orderResult.customerName}</span></div>
                <div className="flex justify-between text-[14px]"><span className="text-gray-500">결제 금액</span><span className="text-indigo-600">{formatWon(orderResult.totalSalePrice)}</span></div>
                <div className="flex justify-between text-[14px]"><span className="text-gray-500">결제 수단</span><span className="text-gray-700">{orderResult.paymentMethod === "card" ? "카드 결제" : "계좌 이체"}</span></div>
                <div className="flex justify-between text-[14px]"><span className="text-gray-500">상태</span><span className="text-emerald-600">접수 완료</span></div>
              </motion.div>
            )}
            {email && (
              <p className="text-indigo-500 text-[12px]">주문 확인 메일이 {email}로 발송되었습니다.</p>
            )}
            <p className="text-gray-400 text-[12px]">
              전화번호({phone})와 비밀번호(4자리)로<br />주문 조회 및 취소가 가능합니다.
            </p>
            <button type="button" onClick={goBack}
              className="w-full flex items-center justify-center gap-1.5 rounded-xl border border-white/40 bg-white/20 py-2.5 text-gray-500 text-[14px] hover:bg-white/40 transition-colors cursor-pointer mt-2">
              <ArrowLeft24Regular className="w-4 h-4" />메인으로 돌아가기
            </button>
          </div>
        );
    }
  };

  const viewTitle: Record<string, string> = {
    main: "교보문고 주문", order: "주문서", lookup: "주문 조회", admin: "관리자 인증", adminProducts: "상품 관리",
  };

  /* ── 렌더 ── */
  if (view === "adminProducts") {
    return (
      <>
        <Toaster position="top-center" richColors toastOptions={{ style: { position: "fixed", top: "50%", left: "50%", transform: "translate(-50%, -50%)" } }} />
        <AdminProductManagement onBack={() => { setViewDirection(-1); setView("main"); setDataVersion((v) => v + 1); }} />
      </>
    );
  }

  return (
    <div className="relative min-h-screen flex flex-col">
      {/* BG */}
      <div className="fixed inset-0 -z-10">
        <div className="absolute inset-0 bg-gradient-to-br from-slate-50 via-indigo-50/60 to-purple-50/40" />
        <div className="absolute top-[-20%] left-[-10%] w-[60%] h-[60%] rounded-full bg-indigo-100/40 blur-[120px]" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] rounded-full bg-purple-100/30 blur-[120px]" />
        <div className="absolute top-[40%] right-[20%] w-[30%] h-[30%] rounded-full bg-sky-100/25 blur-[100px]" />
      </div>

      <Toaster position="top-center" richColors toastOptions={{ style: { position: "fixed", top: "50%", left: "50%", transform: "translate(-50%, -50%)" } }} />

      <CardPaymentModal
        open={showCardPayment} amount={totalPrices.finalPrice}
        onSuccess={() => { setShowCardPayment(false); finalizeOrder(); }}
        onCancel={() => setShowCardPayment(false)}
      />

      <div className={`flex-1 flex flex-col items-center ${view === "main" || view === "lookup" || view === "admin" ? "justify-center" : "justify-start"} px-4 py-6 sm:py-10 transition-all duration-500`}>
        {/* Header */}
        <motion.div layout transition={springTransition} className="text-center mb-5 shrink-0">
          <motion.div layout transition={springTransition} className="inline-flex items-center justify-center w-11 h-11 rounded-xl bg-indigo-600 border border-indigo-700 shadow-[0_4px_16px_rgba(79,70,229,0.3)] mb-2">
            <Cart24Regular className="text-white w-5 h-5" />
          </motion.div>
          <motion.h1 layout transition={springTransition} className="text-gray-900 tracking-tight">{viewTitle[view]}</motion.h1>
          <AnimatePresence mode="wait">
            {view === "main" && (
              <motion.p key="main-sub" initial={{ opacity: 0, y: -5 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 5 }} transition={springTransition}
                className="mt-0.5 text-gray-500 text-[14px]">원하시는 메뉴를 선택해 주세요.</motion.p>
            )}
            {view === "order" && step < TOTAL_STEPS && (
              <motion.p key="order-sub" initial={{ opacity: 0, y: -5 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 5 }} transition={springTransition}
                className="mt-0.5 text-gray-500 text-[14px]">단계별로 정보를 입력하고 주문을 완료하세요.</motion.p>
            )}
          </AnimatePresence>
        </motion.div>

        {/* Step Indicator — 모바일에서는 간소화된 단계 표시, 데스크탑에서는 전체 표시 */}
        {view === "order" && step < TOTAL_STEPS && (
          isMobile ? (
            <div className="mb-4 shrink-0 flex items-center justify-center gap-2">
              {[0, 1, 2, 3].map((i) => (
                <div key={i} className={`h-2 rounded-full transition-all duration-300 ${i === step ? "w-6 bg-indigo-500" : i < step ? "w-2 bg-indigo-400" : "w-2 bg-gray-200"}`} />
              ))}
              <span className="ml-2 text-gray-400 text-[12px]">{step + 1} / {TOTAL_STEPS}</span>
            </div>
          ) : (
            <div className="w-full max-w-sm mb-5 shrink-0">
              <StepIndicator currentStep={step} onStepClick={handleStepClick} />
            </div>
          )
        )}

        {/* Main Panel */}
        <motion.div layout="position" transition={springTransition}
          className={`w-full ${view === "order" && !isMobile && (step === 1 || step === 2 || step === 3) ? (step === 1 ? "max-w-[1200px]" : "max-w-3xl") : "max-w-lg"} origin-top transition-[max-width] duration-500`}>
          <GlassPanel className={`p-5 sm:p-6 ${step === 1 && view === "order" ? "flex flex-col h-[calc(100vh-200px)] min-h-[500px] max-h-[800px]" : "overflow-hidden"}`}>
            <AnimatePresence mode="wait" custom={view === "order" ? direction : viewDirection}>
              {view === "main" && (
                <motion.div key="main" custom={viewDirection} variants={viewVariants}
                  initial="enter" animate="center" exit="exit" transition={springTransition}>
                  <MainPage onNavigate={navigateTo} hideAdmin={isMobile} />
                </motion.div>
              )}
              {view === "order" && (
                <motion.div key={`order-${step}`} custom={direction} variants={stepVariants}
                  initial="enter" animate="center" exit="exit" transition={springTransition}
                  className={step === 1 ? "flex-1 min-h-0" : ""}>
                  {renderStep()}
                </motion.div>
              )}
              {view === "lookup" && (
                <motion.div key="lookup" custom={viewDirection} variants={viewVariants}
                  initial="enter" animate="center" exit="exit" transition={springTransition}>
                  <OrderLookup orders={allOrders} onBack={goBack} />
                </motion.div>
              )}
              {view === "admin" && (
                <motion.div key="admin" custom={viewDirection} variants={viewVariants}
                  initial="enter" animate="center" exit="exit" transition={springTransition}>
                  <AdminLogin onBack={goBack} onSuccess={() => { setViewDirection(1); setView("adminProducts"); }} />
                </motion.div>
              )}
            </AnimatePresence>

            {/* 주문서 네비 버튼 */}
            <AnimatePresence>
              {view === "order" && step < TOTAL_STEPS && (
                <motion.div layout initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                  transition={springTransition}
                  className="flex items-center justify-between mt-3 pt-3 border-t border-gray-200/60 shrink-0">
                  <button type="button" onClick={goPrev}
                    className="flex items-center gap-1 rounded-lg border border-gray-300 bg-white hover:bg-gray-50 px-3 py-2 text-gray-600 text-[13px] transition-all cursor-pointer">
                    <ArrowLeft24Regular className="w-3.5 h-3.5" />{step === 0 ? "메인" : "이전"}
                  </button>
                  {step < TOTAL_STEPS - 1 ? (
                    <button type="button" onClick={goNext}
                      className="flex items-center gap-1 rounded-lg bg-gradient-to-r from-indigo-600 to-purple-600 px-4 py-2 text-white text-[13px] shadow-[0_4px_16px_rgba(79,70,229,0.3)] transition-all hover:shadow-[0_6px_24px_rgba(79,70,229,0.4)] hover:brightness-110 active:scale-[0.98] cursor-pointer">
                      다음<ArrowRight24Regular className="w-3.5 h-3.5" />
                    </button>
                  ) : (
                    <button type="button" onClick={handleSubmit}
                      className="flex items-center gap-1 rounded-lg bg-gradient-to-r from-emerald-600 to-teal-600 px-4 py-2 text-white text-[13px] shadow-[0_4px_16px_rgba(5,150,105,0.3)] transition-all hover:shadow-[0_6px_24px_rgba(5,150,105,0.4)] hover:brightness-110 active:scale-[0.98] cursor-pointer">
                      <Send24Regular className="w-3.5 h-3.5" />주문 접수
                    </button>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </GlassPanel>
        </motion.div>

        <p className="mt-4 text-gray-400 text-[11px]">주문 정보는 안전하게 처리됩니다.</p>
      </div>
    </div>
  );
}
