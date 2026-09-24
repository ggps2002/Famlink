import React, { useEffect, useState } from "react";
import { Form, Modal } from "antd";
import CustomButton from "@shared/ui/Button";

const RANGES = {
    hourly: {
        shared: [
            { label: "$25–30", value: "25-30" },
            { label: "$30–35", value: "30-35" },
            { label: "$35–40", value: "35-40" },
            { label: "$40–45", value: "40-45" },
            { label: "$45–50+", value: "45-50+" },
        ],
        solo: [
            { label: "$20–25", value: "20-25" },
            { label: "$25–30", value: "25-30" },
            { label: "$30–35", value: "30-35" },
            { label: "$35–40", value: "35-40" },
            { label: "$40–45+", value: "40-45+" },
        ],
    },
    weekly: {
        shared: [
            { label: "$800–900", value: "800-900" },
            { label: "$900–1k", value: "900-1000" },
            { label: "$1k–1.1k", value: "1000-1100" },
            { label: "$1.1–1.2k", value: "1100-1200" },
            { label: "$1.2k+", value: "1200+" },
        ],
        solo: [
            { label: "$600–700", value: "600-700" },
            { label: "$700–800", value: "700-800" },
            { label: "$800–900", value: "800-900" },
            { label: "$900–1k", value: "900-1000" },
            { label: "$1k+", value: "1000+" },
        ],
    },
};

/* ✅ FIXED PARSER (uses value, not label) */
const parseRange = (val) => {
    if (!val) return { low: 0, high: 0 };

    if (val.includes("+")) {
        const base = parseFloat(val);
        return { low: base, high: base * 1.15 }; // estimate upper
    }

    const [low, high] = val.split("-").map(Number);
    return { low, high };
};

const SUB = { hourly: "/hr", weekly: "/wk" };
const UNIT = { hourly: "/hour", weekly: "/week" };

function RangeToggle({ active, onChange }) {
    return (
        <div className="flex bg-gray-100 rounded-lg p-1 w-fit mb-5">
            {["hourly", "weekly"].map((tab) => (
                <button
                    key={tab}
                    type="button"
                    onClick={() => onChange(tab)}
                    className={`px-6 py-1.5 rounded-md text-sm Livvic-Medium capitalize transition-all duration-150 ${active === tab
                        ? "bg-white text-gray-900 Livvic-SemiBold shadow-sm"
                        : "text-gray-500 hover:text-gray-700"
                        }`}
                >
                    {tab.charAt(0).toUpperCase() + tab.slice(1)}
                </button>
            ))}
        </div>
    );
}

function RangeSelector({ ranges, selected, onSelect, sub }) {
    return (
        <div className="flex flex-wrap gap-2 mb-3">
            {ranges.map((r) => (
                <button
                    key={r.value}
                    type="button"
                    onClick={() => onSelect(r.value)}
                    className={`flex flex-col items-center min-w-[64px] px-3 py-2 rounded-lg border-2 transition-all duration-150 cursor-pointer ${selected === r.value
                        ? "border-indigo-600 bg-indigo-50 text-indigo-600"
                        : "border-gray-200 bg-white text-gray-700 hover:border-indigo-300"
                        }`}
                >
                    <span className="text-xs Livvic-SemiBold leading-tight">{r.label}</span>
                    <span className="text-[10px] text-gray-400 mt-0.5">{sub}</span>
                </button>
            ))}
        </div>
    );
}

function SelectedRangeDisplay({ label, unit }) {
    if (!label) return null;
    return (
        <div className="bg-indigo-50 rounded-xl px-4 py-3 mt-2 mb-1">
            <span className="block text-[11px] Livvic-Bold text-indigo-600 uppercase tracking-wider mb-1">
                Selected Range
            </span>
            <div className="flex items-baseline gap-2">
                <span className="text-2xl Livvic-Bold text-indigo-600">{label}</span>
                <span className="text-sm text-gray-500">{unit} total</span>
            </div>
        </div>
    );
}

function SectionLabel({ number, text }) {
    return (
        <p className="text-sm Livvic-SemiBold text-gray-800 mb-2.5">
            {number}.{" "}
            {text}
            <span className="text-gray-400 text-xs cursor-pointer ml-1" title="More info">ⓘ</span>
        </p>
    );
}

/* ── Summary Modal ── */
function SummaryModal({ open, onClose, data }) {
    if (!data) return null;

    const { rateType, sharedRate, soloRate } = data;
    const unit = UNIT[rateType];

    const shared = parseRange(sharedRate);
    const solo = parseRange(soloRate);

    const perFamilyLow = (shared.low / 2).toFixed(2);
    const perFamilyHigh = (shared.high / 2).toFixed(2);

    const premium =
        solo.low > 0 ? ((shared.low / solo.low - 1) * 100).toFixed(0) : 0;

    return (
        <Modal open={open} onCancel={onClose} footer={null} centered width={420} className="nanny-summary-modal">
            <div className="p-2">
                <div className="flex items-center gap-2 mb-1">
                    <span className="text-2xl">📋</span>
                    <h3 className="text-lg Livvic-Bold text-gray-900 Livvic-Bold">Your Rate Summary</h3>
                </div>

                <p className="text-xs text-gray-400 mb-5">
                    Here's a breakdown of your nanny share rates.
                </p>

                <div className="flex gap-2 mb-4">
                    <span className="bg-indigo-50 text-indigo-600 text-xs Livvic-SemiBold px-3 py-1 rounded-full capitalize">
                        {rateType} rates
                    </span>
                </div>

                <div className="grid grid-cols-2 gap-3 mb-4">
                    <div className="bg-indigo-50 rounded-xl p-4">
                        <p className="text-[10px] Livvic-Bold text-indigo-400 uppercase tracking-wider mb-1">
                            Shared care
                        </p>
                        <p className="text-xl Livvic-Bold text-indigo-700">{sharedRate}</p>
                        <p className="text-[11px] text-indigo-400">{unit} (both families)</p>
                    </div>

                    <div className="bg-blue-50 rounded-xl p-4">
                        <p className="text-[10px] Livvic-Bold text-blue-400 uppercase tracking-wider mb-1">
                            Solo care
                        </p>
                        <p className="text-xl Livvic-Bold text-blue-700">{soloRate}</p>
                        <p className="text-[11px] text-blue-400">{unit} (one family)</p>
                    </div>
                </div>

                <div className="bg-gray-50 rounded-xl p-4 mb-4">
                    <p className="text-xs Livvic-SemiBold text-gray-500 uppercase tracking-wider mb-2">
                        Estimated per family
                    </p>
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-2xl Livvic-Bold text-gray-800">
                                ${perFamilyLow}–${perFamilyHigh}
                            </p>
                            <p className="text-xs text-gray-400">{unit} each (50 / 50 split)</p>
                        </div>
                        <div className="bg-green-100 text-green-700 text-xs Livvic-SemiBold px-3 py-1 rounded-full">
                            +{premium}% vs solo
                        </div>
                    </div>
                </div>

                <div className="flex items-start gap-2 bg-yellow-50 rounded-xl px-3 py-2.5 mb-5">
                    <span className="text-sm mt-0.5 flex-shrink-0">💡</span>
                    <p className="text-[11px] text-yellow-700 leading-relaxed">
                        This is an estimate. Final amounts are calculated based on the hours you log.
                    </p>
                </div>

                <div className="flex gap-3">
                    <CustomButton onClick={onClose} className="flex-1 border border-gray-200 text-gray-600 text-sm Livvic-Medium rounded-xl py-2.5 hover:bg-gray-50 px-0">
                        Edit Rates
                    </CustomButton>
                </div>
            </div>
        </Modal>
    );
}


// ── Main Component ────────────────────────────────────────────────────────────
function Step5({ formRef }) {
    const [form] = Form.useForm();
    const [rateType, setRateType] = useState("hourly");
    const [sharedRate, setSharedRate] = useState(null);
    const [soloRate, setSoloRate] = useState(null);
    const [summaryOpen, setSummaryOpen] = useState(false);
    const [summaryData, setSummaryData] = useState(null);

    const sharedRanges = RANGES[rateType].shared;
    const soloRanges = RANGES[rateType].solo;
    const sub = SUB[rateType];
    const unit = UNIT[rateType];

    useEffect(() => {
        window.scrollTo({ top: 0, behavior: "smooth" });
    }, []);

    useEffect(() => {
        if (formRef) formRef.current = form;
    }, [formRef, form]);

    const handleRateTypeChange = (type) => {
        setRateType(type);
        setSharedRate(null);
        setSoloRate(null);
        form.setFieldsValue({
            rateType: type,
            sharedRate: undefined,
            soloRate: undefined,
            budget: undefined,
        });
    };

    const handleSharedSelect = (val) => {
        setSharedRate(val);
        const { low, high } = parseRange(val);
        form.setFieldsValue({
            sharedRate: val,
            budget: {
                ...form.getFieldValue("budget"),
                sharedRate: { min: low, max: high },
            },
        });
        form.validateFields(["sharedRate"]);
    };

    const handleSoloSelect = (val) => {
        setSoloRate(val);
        const { low, high } = parseRange(val);
        form.setFieldsValue({
            soloRate: val,
            budget: {
                ...form.getFieldValue("budget"),
                soloRate: { min: low, max: high },
            },
        });
        form.validateFields(["soloRate"]);
    };

    const getLabel = (ranges, val) => ranges.find((r) => r.value === val)?.label ?? "";

    const handleSummary = async () => {
        try {
            const values = await form.validateFields();
            setSummaryData(values);
            setSummaryOpen(true);
        } catch (_) {
            // validation errors shown inline
        }
    };

    return (
        <div className="mb-6">
            <p className="text-primary Livvic-Bold text-center text-4xl px-3 mb-2">
                Set Your Nanny Share Rate
            </p>
            <p className="text-center text-gray-500 text-lg mb-6">
                Enter your rate for shared care and your rate when you care for only one family.
            </p>

            <Form
                form={form}
                name="nannyRateForm"
                autoComplete="off"
                initialValues={{ rateType: "hourly" }}
            >
                <Form.Item name="rateType" noStyle>
                    <input type="hidden" />
                </Form.Item>

                <Form.Item name="budget" noStyle>
                    <input type="hidden" />
                </Form.Item>

                <div className="max-w-md mx-auto bg-white rounded-2xl p-7">
                    <h2 className="text-center text-xl Livvic-Bold text-gray-900 mb-1">
                        What is your rate for nanny share care?
                    </h2>
                    {/* <p className="text-center text-gray-500 text-sm mb-5 leading-relaxed">
                        Enter your rate for shared care and your rate when you care for only one family.
                    </p> */}

                    {/* Single toggle for both sections */}
                    <div className="flex justify-center">
                        <RangeToggle active={rateType} onChange={handleRateTypeChange} />
                    </div>

                    {/* Section 1 */}
                    <div className="mb-6">
                        <SectionLabel number="1" text="What is your rate for shared care (both families)?" />
                        <p className="text-xs text-gray-400 mb-2">Choose an estimate range:</p>

                        <Form.Item name="sharedRate" noStyle rules={[{ required: true, message: "Please select your shared care rate." }]}>
                            <input type="hidden" />
                        </Form.Item>

                        <RangeSelector ranges={sharedRanges} selected={sharedRate} onSelect={handleSharedSelect} sub={sub} />
                        <SelectedRangeDisplay label={getLabel(sharedRanges, sharedRate)} unit={unit} />

                        <Form.Item shouldUpdate noStyle>
                            {() => {
                                const errors = form.getFieldError("sharedRate");
                                return errors.length ? <p className="text-red-500 text-xs mt-1">{errors[0]}</p> : null;
                            }}
                        </Form.Item>
                    </div>

                    {/* Section 2 */}
                    <div className="mb-6">
                        <SectionLabel number="2" text="What is your rate when you care for only one family?" />
                        <p className="text-xs text-gray-400 mb-2">Choose an estimate range:</p>

                        <Form.Item name="soloRate" noStyle rules={[{ required: true, message: "Please select your solo care rate." }]}>
                            <input type="hidden" />
                        </Form.Item>

                        <RangeSelector ranges={soloRanges} selected={soloRate} onSelect={handleSoloSelect} sub={sub} />
                        <SelectedRangeDisplay label={getLabel(soloRanges, soloRate)} unit={unit} />

                        <Form.Item shouldUpdate noStyle>
                            {() => {
                                const errors = form.getFieldError("soloRate");
                                return errors.length ? <p className="text-red-500 text-xs mt-1">{errors[0]}</p> : null;
                            }}
                        </Form.Item>
                    </div>

                    {/* Info note */}
                    <div className="flex items-start gap-3 bg-gray-50 rounded-xl px-4 py-3 mb-5">
                        <span className="text-base mt-0.5 flex-shrink-0">🛡️</span>
                        <p className="text-xs text-gray-500 leading-relaxed">
                            Families will use these rates to calculate who owes what based on the hours you log.
                        </p>
                    </div>

                    {/* CTA */}
                    <CustomButton action={handleSummary} btnText={"See Summary"} className="w-full bg-blue-700 hover:bg-blue-800 text-white Livvic-SemiBold text-sm rounded-xl py-3.5 transition-colors duration-150 cursor-pointer" />
                </div>
            </Form>

            {/* Summary Modal */}
            <SummaryModal
                open={summaryOpen}
                onClose={() => setSummaryOpen(false)}
                data={summaryData}
            />
        </div>
    );
}

export default Step5;