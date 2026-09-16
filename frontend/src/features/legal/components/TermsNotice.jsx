import { Link } from "react-router-dom";
import { useState } from "react";
import { Modal, Button } from "antd";

export default function TermsNotice({ className = "" }) {
  const [isModalVisible, setIsModalVisible] = useState(false);

  const showModal = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsModalVisible(true);
  };

  const handleCancel = () => {
    setIsModalVisible(false);
  };

  return (
    <>
      <p className={`Livvic text-xs text-gray-400 text-center ${className}`}>
        Please review Famlink's{" "}
        <span
          onClick={showModal}
          className="Livvic-SemiBold underline hover:text-[#001243] transition-colors cursor-pointer"
        >
          Terms and Conditions
        </span>
        {" "}and{" "}
        <a href="#" className="Livvic-SemiBold underline hover:text-[#001243] transition-colors cursor-pointer">
          Privacy Policy
        </a>
        {" "}before joining.
      </p>

      <Modal
        title="Famlink - Terms and Conditions"
        open={isModalVisible}
        onCancel={handleCancel}
        centered
        footer={[
          <Link
            key="read-more"
            to="/terms-and-conditions"
            target="_blank"
            rel="noopener noreferrer"
            onClick={handleCancel}
          >
            <Button type="primary" className="Livvic-semibold bg-[#AEC4FF] text-[#001243] border-none hover:bg-[#9cb5ff]">
              Read more
            </Button>
          </Link>,
        ]}
      >
        <div className="text-sm text-gray-600 space-y-3 mt-4">
          <p>
            Welcome to <span className="Livvic-Bold">Famlink</span> — a platform built to help families and caregivers connect for nanny share
            arrangements. We believe that trust, transparency, and safety are the foundation of every great
            childcare relationship. These Terms and Conditions govern your use of our platform and are
            designed to be clear, fair, and protective of your rights.
          </p>
          <p>
            By creating an account or using Famlink in any way, you agree to these Terms. If you do not
            agree, please do not use the platform.
          </p>
          <p>
            <span className="Livvic-SemiBold">1. About Famlink</span><br />
            Famlink is operated by <span className="Livvic-Bold">Famylink, Inc.</span>, a corporation incorporated under the laws of the State of
            Delaware (“Famlink,” “Company,” “we,” “us,” or “our”). Famlink operates the platform accessible
            at <span className="Livvic-Bold">www.famlink.care.....</span>
          </p>
        </div>
      </Modal>
    </>
  );
}
