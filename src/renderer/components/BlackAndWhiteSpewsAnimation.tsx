import spewsSourceUrl from "../assets/animations/black-and-white-spews.html?url";

export function BlackAndWhiteSpewsAnimation() {
  return (
    <div className="black-white-spews-animation" aria-hidden="true">
      <iframe src={spewsSourceUrl} title="Image generation animation" tabIndex={-1} />
    </div>
  );
}
