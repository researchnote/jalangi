// Author: Nguyen Duc Than - NUS

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
