/*
 * Copyright 2013 Samsung Information Systems America, Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *        http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

// Author: Koushik Sen

if (typeof window === "undefined") {
    require('../../src/js/InputManager');
    require(process.cwd()+'/inputs');
}

var x = J$.readInput(22);
var y = J$.readInput(7);

function twice(v)
{
  return (v*v)%50;
}

function test(x, y)
{
  z = twice(y);


  if(x === z)
  {
    console.log("TRUE");
    console.log("x = ", x, ", y = ",y);
    if(x > y + 10)
    {
      console.log("TRUE");
      console.log("x = ", x, ", y = ",y);
      console.log("ERROR");
    }
    else {
      console.log("FALSE");
      console.log("x = ", x, ", y = ",y);

    }
  }
  else {
    console.log("FALSE");
    console.log("x = ", x, ", y = ",y);

  }
}

test(x,y);
