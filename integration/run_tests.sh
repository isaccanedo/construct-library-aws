#!/usr/bin/env bash

set -u -e -o pipefail

cd "$(dirname "$0")"

# basedir is the workspace root
readonly basedir=$(pwd)/..

${basedir}/scripts/build-packages-dist.sh

TEST_DIRS=$(ls | grep -v node_modules)

# Workaround https://github.com/yarnpkg/yarn/issues/2165
# Yarn will cache file://dist URIs and not update code
readonly cache=.yarn_local_cache
function rm_cache {
  rm -rf $cache
}
rm_cache
mkdir $cache
trap rm_cache EXIT

for testDir in ${TEST_DIRS}; do
  [[ -d "$testDir" ]] || continue
  echo "#################################"
  echo "Running integration test $testDir"
  echo "#################################"
  (
    cd $testDir
    rm -rf dist

    npm install # --cache-folder ../$cache # TODO: change to yarn
    npm run test || exit 1

    # remove the temporary node modules directory to keep the source folder clean.
    rm -rf node_modules
  )
done
