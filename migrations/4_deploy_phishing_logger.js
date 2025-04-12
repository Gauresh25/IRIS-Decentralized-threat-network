const SimplifiedPhishingLogger = artifacts.require("SimplifiedPhishingLogger");

module.exports = function(deployer) {
  deployer.deploy(SimplifiedPhishingLogger);
};