class OpenclasCli < Formula
  desc "CLI and health-watch daemon for OpenClaw AI assistant gateway"
  homepage "https://github.com/Sobranier/openclaw-doctor"
  url "https://github.com/Sobranier/openclaw-doctor/archive/refs/tags/v0.3.0.tar.gz"
  sha256 "REPLACE_WITH_SHA256_AFTER_RELEASE"
  license "MIT"
  head "https://github.com/Sobranier/openclaw-doctor.git", branch: "main"

  depends_on "node"

  def install
    system "npm", "install", *std_npm_args
    # Install the openclaw-cli binary
    bin.install_symlink Dir["#{libexec}/bin/openclaw-cli"]
    # Also provide openclaw-doctor alias for backward compatibility
    bin.install_symlink Dir["#{libexec}/bin/openclaw-cli"] => "openclaw-doctor"
  end

  test do
    assert_match version.to_s, shell_output("#{bin}/openclaw-cli --version")
  end
end
