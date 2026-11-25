import CommonBanner from "@/common/CommonBanner";
import bannerImg from "../assets/service/serviceBanner.png";

const Services = () => {
  return (
    <div className="mt-[70px]">
      <CommonBanner
        title="Our services"
        route="Home / services"
        bgImage={bannerImg}
      />
    </div>
  );
};

export default Services;
