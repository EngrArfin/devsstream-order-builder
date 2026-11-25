import CommonBanner from "@/common/CommonBanner";
import bannerImg from "../assets/About/aboutBanner.png";

const About = () => {
  return (
    <div className="mt-[70px]">
      <CommonBanner
        title="About Us"
        route="Home / About us"
        bgImage={bannerImg}
      />
    </div>
  );
};

export default About;
