import bannerImg from "../assets/Common/contactBanner.png";
import CommonBanner from "@/common/CommonBanner";
import GetInTouch from "@/components/Contact/GetInTouch";
import ContactUs from "@/components/Contact/ContactUs";

const Contact = () => {
  return (
    <div className="mt-[70px]">
      <CommonBanner
        title="Contact us"
        route="Home / Contacts"
        bgImage={bannerImg}
      />
      <GetInTouch />
      <ContactUs />
    </div>
  );
};

export default Contact;
